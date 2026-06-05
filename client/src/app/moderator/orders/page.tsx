"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/api";
import ModeratorHeader from "@/components/moderator/ModeratorHeader";

interface OrderItem {
  _id: string;
  groceryItem?: {
    _id: string;
    name: string;
    price: number;
    images?: string[];
    brand?: string;
    unit?: string;
    weightSize?: string;
  };
  quantity: number;
  price: number;
}

interface Order {
  _id: string;
  user: {
    _id: string;
    name: string;
    phone: string;
    email?: string;
  };
  orderType: "grocery";
  items: OrderItem[];
  totalAmount: number;
  deliveryCharge: number;
  paymentMethod: "COD" | "ONLINE";
  paymentStatus: "pending" | "paid" | "failed";
  orderStatus: "placed" | "accepted" | "preparing" | "on_the_way" | "delivered" | "cancelled";
  address: {
    fullAddress: string;
  };
  deliveryZone?: {
    _id: string;
    name: string;
  };
  createdAt: string;
}

export default function ModeratorOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed">("active");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      const res = await apiClient.get("/orders/grocery");
      if (res.data.success) {
        setOrders(res.data.orders || []);
      }
    } catch (err) {
      console.error("Failed to load grocery orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Real-time polling every 5 seconds for new grocery orders
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    setUpdatingId(orderId);
    try {
      const res = await apiClient.patch(`/orders/${orderId}/status`, {
        orderStatus: nextStatus
      });
      if (res.data.success) {
        // Refresh orders list
        await fetchOrders();
      }
    } catch (err: any) {
      console.error("Failed to update status:", err);
      alert("Error: " + (err.response?.data?.message || err.message));
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter orders based on active tab and search query
  const filteredOrders = orders.filter((order) => {
    // 1. Tab Filter
    const isActive = ["placed", "accepted", "preparing", "on_the_way"].includes(order.orderStatus);
    const isCompleted = ["delivered", "cancelled"].includes(order.orderStatus);

    if (activeTab === "active" && !isActive) return false;
    if (activeTab === "completed" && !isCompleted) return false;

    // 2. Search Filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const orderIdMatch = order._id.toLowerCase().includes(query);
      const userNameMatch = order.user?.name?.toLowerCase().includes(query);
      const userPhoneMatch = order.user?.phone?.includes(query);
      return orderIdMatch || userNameMatch || userPhoneMatch;
    }

    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "placed":
        return "bg-blue-50 text-blue-700 border-blue-100";
      case "accepted":
      case "preparing":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "on_the_way":
        return "bg-indigo-50 text-indigo-700 border-indigo-100";
      case "delivered":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "cancelled":
        return "bg-rose-50 text-rose-700 border-rose-100";
      default:
        return "bg-slate-50 text-slate-700 border-slate-100";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "placed": return "New Order";
      case "accepted": return "Accepted";
      case "preparing": return "Preparing";
      case "on_the_way": return "On The Way";
      case "delivered": return "Delivered";
      case "cancelled": return "Cancelled";
      default: return status;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <ModeratorHeader title="Grocery Orders Desk" />

      <main className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto">
        {/* Controls Panel */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tab Filter */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl shrink-0 w-fit">
            <button
              onClick={() => setActiveTab("active")}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "active"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Active Orders ({orders.filter(o => ["placed", "accepted", "preparing", "on_the_way"].includes(o.orderStatus)).length})
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "completed"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Completed / Cancelled ({orders.filter(o => ["delivered", "cancelled"].includes(o.orderStatus)).length})
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "all"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              All Orders ({orders.length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
            <input
              type="text"
              placeholder="Search by Order ID, Customer Name, or Phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-5 py-3 text-xs bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white focus:outline-none rounded-2xl font-semibold transition-all text-slate-800 placeholder-slate-400"
            />
          </div>
        </div>

        {/* Loading Skeletons */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-3xl border border-slate-100 p-6 space-y-4 shadow-sm animate-pulse h-80">
                <div className="flex justify-between">
                  <div className="h-4 w-1/3 bg-slate-100 rounded" />
                  <div className="h-6 w-1/4 bg-slate-100 rounded-full" />
                </div>
                <div className="h-1 bg-slate-50 rounded my-3" />
                <div className="space-y-2">
                  <div className="h-3 w-1/2 bg-slate-100 rounded" />
                  <div className="h-3 w-2/3 bg-slate-100 rounded" />
                </div>
                <div className="h-20 bg-slate-50 rounded-2xl" />
                <div className="h-10 w-full bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          /* Empty State */
          <div className="bg-white border border-slate-100 rounded-3xl p-16 flex flex-col items-center justify-center text-center max-w-lg mx-auto shadow-sm">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-5 border border-emerald-100">
              <span className="material-symbols-outlined text-[36px] text-emerald-600">receipt_long</span>
            </div>
            <h3 className="text-lg font-black text-slate-800 leading-none">No Grocery Orders Found</h3>
            <p className="text-slate-400 text-xs font-semibold leading-relaxed mt-2.5 max-w-xs">
              No grocery orders currently match this selection. New orders will show up here automatically when placed by users!
            </p>
          </div>
        ) : (
          /* Orders Grid */
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {filteredOrders.map((order) => {
              const isUnpaidOnline = order.paymentMethod === "ONLINE" && order.paymentStatus !== "paid";
              return (
                <div 
                  key={order._id} 
                  className={`bg-white rounded-3xl border border-slate-100 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between relative overflow-hidden ${
                    isUnpaidOnline ? 'ring-1 ring-rose-500/20 bg-rose-50/5' : ''
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex justify-between items-start gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                            ID: #ORD-{order._id.substring(order._id.length - 6).toUpperCase()}
                          </span>
                          {order.deliveryZone && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100/50 text-[8px] font-black uppercase rounded">
                              <span className="material-symbols-outlined text-[8px]">location_on</span>
                              {order.deliveryZone.name}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-700">
                          Placed: {new Date(order.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })} at {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </h4>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold border ${getStatusBadge(order.orderStatus)}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {getStatusLabel(order.orderStatus)}
                      </span>
                    </div>

                    <div className="border-t border-slate-100 my-4" />

                    {/* Customer Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-slate-500 mb-4">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider mb-1">Customer</p>
                        <p className="text-slate-800 font-bold">{order.user?.name || "Customer"}</p>
                        <p className="text-slate-500 font-medium">{order.user?.phone || "No phone"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider mb-1">Delivery Address</p>
                        <p className="text-slate-700 font-medium line-clamp-2 leading-relaxed">{order.address?.fullAddress || "Address details"}</p>
                      </div>
                    </div>

                    {/* Order Items Table/List */}
                    <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 mb-5">
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Grocery Basket</p>
                      <div className="space-y-3.5 max-h-48 overflow-y-auto pr-1">
                        {order.items.map((item) => (
                          <div key={item._id} className="flex justify-between items-center text-xs font-semibold">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-white rounded-lg border border-slate-200/50 overflow-hidden flex items-center justify-center shrink-0">
                                {item.groceryItem?.images && item.groceryItem.images[0] ? (
                                  <img src={item.groceryItem.images[0]} alt={item.groceryItem.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="material-symbols-outlined text-[14px] text-slate-450">local_mall</span>
                                )}
                              </div>
                              <span className="text-slate-800 line-clamp-1">
                                {item.groceryItem?.name || "Grocery Product"} 
                                {item.groceryItem?.brand && <span className="text-[10px] text-slate-400 font-medium ml-1">({item.groceryItem.brand})</span>}
                              </span>
                            </div>
                            <span className="text-slate-500 shrink-0 font-medium">
                              {item.quantity} x ₹{item.price}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Payment status & Interactive Actions */}
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-auto">
                    {/* Payment Status Summary */}
                    <div className="text-xs font-semibold">
                      <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Payment Details</p>
                      <div className="flex items-center gap-2 text-slate-800">
                        <span className="font-extrabold text-[#059669]">₹{order.totalAmount.toLocaleString()}</span>
                        <span className="text-slate-350">|</span>
                        <span className="uppercase text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">{order.paymentMethod}</span>
                        {isUnpaidOnline ? (
                          <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded flex items-center gap-1 select-none">
                            <span className="w-1 h-1 rounded-full bg-rose-500 animate-pulse"></span>
                            UNPAID
                          </span>
                        ) : (
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                            order.paymentStatus === 'paid' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'
                          }`}>
                            {order.paymentStatus === 'paid' ? 'PAID' : 'PENDING'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      {isUnpaidOnline ? (
                        /* Unpaid Online Orders Warning for Moderator */
                        <div className="text-[10px] font-black text-rose-700 bg-rose-50/70 border border-rose-100 px-4 py-2.5 rounded-xl flex items-center gap-1.5 select-none">
                          <span className="material-symbols-outlined text-[15px]">credit_card_off</span>
                          Waiting for online payment
                        </div>
                      ) : (
                        <>
                          {/* Accept Order Action */}
                          {order.orderStatus === "placed" && (
                            <button
                              onClick={() => handleUpdateStatus(order._id, "preparing")}
                              disabled={updatingId === order._id}
                              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider rounded-xl shadow-sm hover:shadow active:scale-95 transition-all flex items-center justify-center gap-1.5"
                            >
                              {updatingId === order._id ? "..." : "Accept & Prepare"}
                            </button>
                          )}

                          {/* Preparing Dispatch Action */}
                          {order.orderStatus === "preparing" && (
                            <button
                              onClick={() => handleUpdateStatus(order._id, "on_the_way")}
                              disabled={updatingId === order._id}
                              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-black uppercase tracking-wider rounded-xl shadow-sm hover:shadow active:scale-95 transition-all flex items-center justify-center gap-1.5"
                            >
                              {updatingId === order._id ? "..." : "Mark Packed & Ship"}
                            </button>
                          )}

                          {/* Out For Delivery Action */}
                          {order.orderStatus === "on_the_way" && (
                            <button
                              onClick={() => handleUpdateStatus(order._id, "delivered")}
                              disabled={updatingId === order._id}
                              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider rounded-xl shadow-sm hover:shadow active:scale-95 transition-all flex items-center justify-center gap-1.5"
                            >
                              {updatingId === order._id ? "..." : "Mark as Delivered"}
                            </button>
                          )}

                          {/* Cancellation Action */}
                          {["placed", "accepted", "preparing"].includes(order.orderStatus) && (
                            <button
                              onClick={() => {
                                if (confirm("Are you sure you want to cancel this grocery order?")) {
                                  handleUpdateStatus(order._id, "cancelled");
                                }
                              }}
                              disabled={updatingId === order._id}
                              className="px-3.5 py-2.5 border border-slate-200 hover:border-red-200 hover:bg-red-50 hover:text-red-700 text-slate-500 text-[11px] font-black uppercase tracking-wider rounded-xl active:scale-95 transition-all flex items-center justify-center"
                            >
                              {updatingId === order._id ? "..." : "Cancel"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
