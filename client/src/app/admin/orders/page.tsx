"use client";

import React, { useEffect, useState, useCallback } from "react";
import { apiClient } from "@/services/api";
import { useOrderSocket } from "@/hooks/useOrderSocket";
import { 
  MdSearch, 
  MdRefresh, 
  MdChevronRight, 
  MdClose, 
  MdLocationOn, 
  MdPerson, 
  MdPhone, 
  MdEmail, 
  MdRestaurant, 
  MdShoppingBag, 
  MdPayment, 
  MdCancel, 
  MdInfo,
  MdAccessTime
} from "react-icons/md";

interface Order {
  _id: string;
  user: {
    name: string;
    phone: string;
  };
  restaurant?: {
    name: string;
  };
  orderType: "food" | "grocery";
  totalAmount: number;
  paymentMethod: "COD" | "ONLINE";
  paymentStatus: "pending" | "paid" | "failed";
  orderStatus: string;
  createdAt: string;
}

interface OrderDetailModalProps {
  order: any;
  onClose: () => void;
  onCancel: (orderId: string) => Promise<void>;
  cancelling: boolean;
}

function OrderDetailModal({ order, onClose, onCancel, cancelling }: OrderDetailModalProps) {
  if (!order) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'placed': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'accepted': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'preparing': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'accepted_by_delivery': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'on_the_way':
      case 'out_for_delivery': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const formatStatus = (status: string) => {
    if (!status) return 'Placed';
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const isCancellable = !["delivered", "cancelled"].includes(order.orderStatus);

  return (
    <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-start sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-black text-slate-900">
                Order #{order._id.substring(order._id.length - 8).toUpperCase()}
              </h3>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border ${getStatusColor(order.orderStatus)}`}>
                {formatStatus(order.orderStatus)}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono select-all">
              Full ID: {order._id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 flex items-center justify-center transition-colors"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">

          {/* Cancellation Notice if Cancelled */}
          {order.orderStatus === "cancelled" && (
            <div className="bg-red-50/80 border border-red-200 rounded-xl p-4 text-xs text-red-800">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <MdCancel className="text-base text-red-600" />
                Order Cancelled
              </div>
              <p><span className="font-semibold">Reason:</span> {order.cancellationReason || "No specific reason recorded."}</p>
              {order.cancelledAt && (
                <p className="text-red-600 mt-1">
                  Cancelled on {new Date(order.cancelledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </p>
              )}
            </div>
          )}

          {/* Grid Information: Customer & Fulfillment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Customer Details */}
            <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-4">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-2.5 uppercase tracking-wider text-[11px]">
                <MdPerson className="text-slate-500 text-sm" /> Customer Details
              </div>
              <p className="font-bold text-slate-900 text-sm">{order.user?.name || "Customer"}</p>
              {order.user?.phone && (
                <p className="text-slate-600 mt-1 flex items-center gap-1">
                  <MdPhone className="text-slate-400" /> +91 {order.user.phone}
                </p>
              )}
              {order.user?.email && (
                <p className="text-slate-600 mt-0.5 flex items-center gap-1">
                  <MdEmail className="text-slate-400" /> {order.user.email}
                </p>
              )}
            </div>

            {/* Hub / Vendor & Timing */}
            <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-4">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-2.5 uppercase tracking-wider text-[11px]">
                {order.orderType === "food" ? <MdRestaurant className="text-slate-500 text-sm" /> : <MdShoppingBag className="text-slate-500 text-sm" />}
                {order.orderType === "food" ? "Restaurant Partner" : "Grocery Fulfillment"}
              </div>
              <p className="font-bold text-slate-900 text-sm">
                {order.restaurant?.name || (order.orderType === "grocery" ? "ZipGrocery Hub" : "Hyperlocal Hub")}
              </p>
              <p className="text-slate-600 mt-1 flex items-center gap-1">
                <MdAccessTime className="text-slate-400" />
                Placed: {new Date(order.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
              </p>
              <p className="text-slate-600 mt-0.5">
                <span className="font-semibold">Type:</span> <span className="capitalize font-bold text-slate-800">{order.orderType} Order</span>
              </p>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-4 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-2 uppercase tracking-wider text-[11px]">
              <MdLocationOn className="text-slate-500 text-sm" /> Delivery Destination
            </div>
            <p className="text-slate-800 font-medium">
              {order.address?.fullAddress || "No full address recorded"}
            </p>
            {order.address?.deliveryAddress && (
              <div className="mt-2 text-slate-600 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200/60">
                {order.address.deliveryAddress.houseNumber && <p><span className="font-semibold">House/Flat:</span> {order.address.deliveryAddress.houseNumber}</p>}
                {order.address.deliveryAddress.landmark && <p><span className="font-semibold">Landmark:</span> {order.address.deliveryAddress.landmark}</p>}
                {order.address.deliveryAddress.locality && <p><span className="font-semibold">Locality:</span> {order.address.deliveryAddress.locality}</p>}
                {order.address.deliveryAddress.village && <p><span className="font-semibold">Village:</span> {order.address.deliveryAddress.village}</p>}
                {order.address.deliveryAddress.pincode && <p><span className="font-semibold">Pincode:</span> {order.address.deliveryAddress.pincode}</p>}
                {order.address.deliveryAddress.instructions && <p className="col-span-2 text-amber-700"><span className="font-semibold">Notes:</span> {order.address.deliveryAddress.instructions}</p>}
              </div>
            )}
          </div>

          {/* Ordered Items Table */}
          <div>
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2.5">
              Items Ordered ({order.items?.length || 0})
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="py-2.5 px-3.5">Item</th>
                    <th className="py-2.5 px-3.5 text-center">Qty</th>
                    <th className="py-2.5 px-3.5 text-right">Price</th>
                    <th className="py-2.5 px-3.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {order.items?.map((item: any, idx: number) => {
                    const itemName = item.menuItem?.name || item.groceryItem?.name || "Product Item";
                    const itemPrice = Number(item.price) || 0;
                    const itemQty = Number(item.quantity) || 1;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/40">
                        <td className="py-2.5 px-3.5 font-medium text-slate-900">
                          {itemName}
                          {item.groceryItem?.weightSize && (
                            <span className="text-[10px] text-slate-400 ml-1">({item.groceryItem.weightSize})</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-bold text-slate-800">{itemQty}</td>
                        <td className="py-2.5 px-3.5 text-right text-slate-600">₹{itemPrice.toFixed(2)}</td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-slate-900">₹{(itemPrice * itemQty).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bill Breakdown & Payment Status */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/70 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Delivery Charge</span>
              <span>₹{(Number(order.deliveryCharge) || 0).toFixed(2)}</span>
            </div>
            {Number(order.discountAmount) > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Coupon Discount {order.couponCode ? `(${order.couponCode})` : ""}</span>
                <span>-₹{(Number(order.discountAmount) || 0).toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-slate-200 pt-2.5 mt-2 flex justify-between font-black text-slate-900 text-sm">
              <span>Total Amount</span>
              <span className="text-[#FF5C00]">₹{(Number(order.totalAmount) || 0).toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                <MdPayment className="text-sm" /> Payment Method: <span className="uppercase font-bold text-slate-900">{order.paymentMethod}</span>
              </div>
              <div>
                Payment Status:{" "}
                <span className={`font-bold uppercase px-2 py-0.5 rounded ${order.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : order.paymentStatus === 'failed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                  {order.paymentStatus}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3 sticky bottom-0">
          <div className="text-[11px] text-slate-400 font-medium">
            {order.paymentMethod === "ONLINE" && order.paymentStatus === "paid" && isCancellable && (
              <span className="flex items-center gap-1 text-amber-700">
                <MdInfo className="text-xs" /> Online refund requires manual initiation in Razorpay dashboard.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors shadow-sm"
            >
              Close
            </button>
            {isCancellable && (
              <button
                onClick={() => onCancel(order._id)}
                disabled={cancelling}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
              >
                <MdCancel className="text-sm" />
                {cancelling ? "Cancelling Order..." : "Cancel Order"}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default function OrdersAdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await apiClient.get("/orders");
      if (res.data.success) {
        setOrders(res.data.orders || []);
      }
    } catch (err) {
      console.error("Failed to fetch admin orders:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleViewOrder = async (orderId: string) => {
    setLoadingDetail(true);
    try {
      const res = await apiClient.get(`/orders/${orderId}`);
      if (res.data.success) {
        setSelectedOrder(res.data.order);
      }
    } catch (err) {
      console.error("Failed to fetch order detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    setCancelling(true);
    try {
      const res = await apiClient.patch(`/orders/${orderId}/cancel`, { reason: "Cancelled by admin" });
      if (res.data.success) {
        setOrders((prev) => prev.map((o) => o._id === orderId ? { ...o, orderStatus: "cancelled" } : o));
        setSelectedOrder((prev: any) => prev ? { ...prev, orderStatus: "cancelled", cancellationReason: "Cancelled by admin", cancelledAt: new Date().toISOString() } : prev);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to cancel order.");
    } finally {
      setCancelling(false);
    }
  };

  // Real-time updates for Admin
  useOrderSocket({
    onNewOrder: (data) => {
      if (data?.order) {
        setOrders((prev) => {
          const exists = prev.some((o) => o._id === data.order._id);
          if (exists) return prev;
          return [data.order, ...prev];
        });
      } else {
        fetchOrders();
      }
    },
    onOrderStatusUpdated: (data) => {
      if (data?.orderId && data?.orderStatus) {
        setOrders((prev) =>
          prev.map((o) =>
            o._id === data.orderId ? { ...o, orderStatus: data.orderStatus } : o
          )
        );
        setSelectedOrder((prev: any) =>
          prev && prev._id === data.orderId ? { ...prev, orderStatus: data.orderStatus } : prev
        );
      }
    },
    onOrderCancelled: (data) => {
      if (data?.orderId) {
        setOrders((prev) =>
          prev.map((o) =>
            o._id === data.orderId ? { ...o, orderStatus: "cancelled" } : o
          )
        );
        setSelectedOrder((prev: any) =>
          prev && prev._id === data.orderId ? { ...prev, orderStatus: "cancelled" } : prev
        );
      }
    },
    onDeliveryAccepted: (data) => {
      if (data?.orderId) {
        setOrders((prev) =>
          prev.map((o) =>
            o._id === data.orderId ? { ...o, orderStatus: "accepted_by_delivery" } : o
          )
        );
      }
    },
    onDeliveryStatusUpdated: (data) => {
      if (data?.orderId && data?.status) {
        setOrders((prev) =>
          prev.map((o) =>
            o._id === data.orderId ? { ...o, orderStatus: data.status } : o
          )
        );
      }
    },
    onOrderDelivered: (data) => {
      if (data?.orderId) {
        setOrders((prev) =>
          prev.map((o) =>
            o._id === data.orderId ? { ...o, orderStatus: "delivered" } : o
          )
        );
        setSelectedOrder((prev: any) =>
          prev && prev._id === data.orderId ? { ...prev, orderStatus: "delivered" } : prev
        );
      }
    },
    onPaymentStatusUpdated: (data) => {
      if (data?.orderId && data?.paymentStatus) {
        setOrders((prev) =>
          prev.map((o) =>
            o._id === data.orderId ? { ...o, paymentStatus: data.paymentStatus as any } : o
          )
        );
        setSelectedOrder((prev: any) =>
          prev && prev._id === data.orderId ? { ...prev, paymentStatus: data.paymentStatus } : prev
        );
      }
    },
    onReconnect: () => {
      fetchOrders();
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-700';
      case 'placed': return 'bg-amber-50 text-amber-700';
      case 'accepted': return 'bg-blue-50 text-blue-700';
      case 'preparing': return 'bg-orange-50 text-orange-700';
      case 'accepted_by_delivery': return 'bg-purple-50 text-purple-700';
      case 'ready': return 'bg-blue-50 text-blue-700';
      case 'out_for_delivery':
      case 'on_the_way': return 'bg-indigo-50 text-indigo-700';
      case 'delivered': return 'bg-emerald-50 text-emerald-700';
      case 'cancelled': return 'bg-red-50 text-red-700';
      default: return 'bg-slate-50 text-slate-700';
    }
  };

  const formatStatus = (status: string) => {
    if (!status) return 'Placed';
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    const matchesSearch = 
      o._id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.user?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.restaurant?.name || "").toLowerCase().includes(searchQuery.toLowerCase());
      
    if (!matchesSearch) return false;
    
    if (statusFilter === "all") return true;
    return o.orderStatus === statusFilter;
  });

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30 flex flex-col">

      {/* Dashboard Header */}
      <div className="flex justify-between items-start mb-8">
        <div className="max-w-2xl">
          <h2 className="text-[32px] font-bold text-slate-900 tracking-tight leading-none mb-3">Order Management</h2>
          <p className="text-[14px] text-slate-500 leading-relaxed">
            Review and manage logistics flow for active and<br />
            historical orders. Click any order row to view itemized breakdown and admin actions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-[300px]">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]" />
            <input
              type="text"
              placeholder="Search by Order ID or Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all shadow-sm"
            />
          </div>
          <button 
            onClick={fetchOrders}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-[13px] font-bold hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <MdRefresh className="text-[18px]" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Active Orders */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-4">Active Orders</p>
          <div className="flex items-center gap-3">
            <h3 className="text-[32px] font-bold text-slate-900 leading-none">
              {loading ? "..." : orders.filter(o => !["delivered", "cancelled"].includes(o.orderStatus)).length}
            </h3>
          </div>
        </div>

        {/* Preparing */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-4">Preparing</p>
          <div className="flex items-center gap-3">
            <h3 className="text-[32px] font-bold text-slate-900 leading-none">
              {loading ? "..." : orders.filter(o => o.orderStatus === "preparing").length}
            </h3>
          </div>
        </div>

        {/* In Transit */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-4">In Transit</p>
          <div className="flex items-center gap-3">
            <h3 className="text-[32px] font-bold text-slate-900 leading-none">
              {loading ? "..." : orders.filter(o => ["on_the_way", "out_for_delivery"].includes(o.orderStatus)).length}
            </h3>
          </div>
        </div>

        {/* Avg Delivery Time */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-4">Delivered Orders</p>
          <div className="flex items-center gap-3">
            <h3 className="text-[32px] font-bold text-slate-900 leading-none">
              {loading ? "..." : orders.filter(o => o.orderStatus === "delivered").length}
            </h3>
          </div>
        </div>
      </div>

      {/* Filter and Table Options */}
      <div className="flex items-center gap-3 mb-4 self-end">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Filter Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm transition-colors"
        >
          <option value="all">All Orders</option>
          <option value="placed">Placed (New)</option>
          <option value="accepted">Accepted</option>
          <option value="preparing">Preparing</option>
          <option value="accepted_by_delivery">Accepted By Delivery</option>
          <option value="on_the_way">On The Way</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Main Table Area */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden mb-12">

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-5 px-6 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Order ID</th>
                <th className="py-5 px-6 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="py-5 px-6 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Restaurant / Hub</th>
                <th className="py-5 px-6 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Date & Time</th>
                <th className="py-5 px-6 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Total</th>
                <th className="py-5 px-6 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="py-5 px-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold text-xs">
                    Loading orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-bold text-xs">
                    No orders found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr 
                    key={order._id} 
                    onClick={() => handleViewOrder(order._id)}
                    className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                  >
                    <td className="py-5 px-6">
                      <span className="text-[14px] font-bold text-slate-900 group-hover:text-[#FF5C00] transition-colors">
                        #ORD-<br />{order._id.substring(order._id.length - 6).toUpperCase()}
                      </span>
                    </td>
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-600 uppercase">
                          {order.user?.name?.substring(0, 2) || "US"}
                        </div>
                        <div>
                          <span className="text-[14px] font-bold text-slate-950 block">{order.user?.name || "Customer"}</span>
                          <span className="text-[10px] text-slate-400 block font-semibold">+91 {order.user?.phone || "N/A"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <span className="text-[14px] text-slate-700 font-semibold">
                        {order.restaurant?.name || (order.orderType === "grocery" ? "ZipGrocery Hub" : "Hyperlocal Partner")}
                      </span>
                    </td>
                    <td className="py-5 px-6">
                      <span className="text-[14px] text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}<br />
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="py-5 px-6">
                      <span className="text-[14px] font-bold text-slate-900">₹{order.totalAmount}</span>
                    </td>
                    <td className="py-5 px-6">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider ${getStatusColor(order.orderStatus)}`}>
                        {formatStatus(order.orderStatus)}
                      </span>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <MdChevronRight className="text-slate-300 text-[20px] group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all inline-block" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal 
          order={selectedOrder} 
          onClose={() => setSelectedOrder(null)} 
          onCancel={handleCancelOrder}
          cancelling={cancelling}
        />
      )}

    </div>
  );
}
