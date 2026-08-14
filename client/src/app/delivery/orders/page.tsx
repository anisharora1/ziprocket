"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../../../services/api";
import { useOrderSocket } from "../../../hooks/useOrderSocket";
import { useSocket } from "../../../context/SocketContext";
import {
  MdSync,
  MdTask,
  MdStore,
  MdNavigation,
  MdLocationOn,
  MdContentCopy,
  MdCall,
  MdCheckCircle,
  MdExplore,
  MdClose,
  MdCheck,
} from "react-icons/md";

interface OrderItem {
  _id: string;
  menuItem?: { name: string };
  groceryItem?: { name: string };
  quantity: number;
  price: number;
}

interface Order {
  _id: string;
  user: {
    name: string;
    phone: string;
  };
  restaurant?: {
    name: string;
    address: string;
    location?: { lat: number; lng: number };
  };
  deliveryZone?: {
    name: string;
    center: { lat: number; lng: number };
  };
  orderType: "food" | "grocery";
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: "COD" | "ONLINE";
  paymentStatus: "pending" | "paid" | "failed";
  orderStatus: string;
  address: {
    fullAddress: string;
    lat?: number;
    lng?: number;
  };
  createdAt: string;
}

interface DeliveryRecord {
  _id: string;
  order: Order;
  status: string;
  earnings: number;
  createdAt: string;
}

export default function DeliveryOrdersPage() {
  const [activeTasks, setActiveTasks] = useState<DeliveryRecord[]>([]);
  const [pendingQueue, setPendingQueue] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const { joinDeliveryZone } = useSocket();

  const handleCopyAddress = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Address copied to clipboard! / पता कॉपी हो गया!");
  };

  const fetchOrdersData = useCallback(async () => {
    try {
      const [tasksRes, queueRes] = await Promise.all([
        apiClient.get("/delivery/my-deliveries"),
        apiClient.get("/delivery/pending")
      ]);

      if (tasksRes.data.success) {
        setActiveTasks(tasksRes.data.deliveries || []);
      }
      if (queueRes.data.success) {
        setPendingQueue(queueRes.data.orders || []);
      }
    } catch (err) {
      console.error("Failed to load delivery orders page data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrdersData();

    // Auto-join delivery zone for targeted zone broadcasts
    apiClient.get("/delivery/profile/my-profile").then((res) => {
      if (res.data?.success && res.data?.profile?.deliveryZone) {
        const zoneId = res.data.profile.deliveryZone._id || res.data.profile.deliveryZone;
        joinDeliveryZone(zoneId.toString());
      }
    }).catch(() => {});
  }, [fetchOrdersData, joinDeliveryZone]);

  // Real-time socket event integration
  useOrderSocket({
    onNewOrder: () => {
      fetchOrdersData();
    },
    onDeliveryAssigned: () => {
      fetchOrdersData();
    },
    onDeliveryAccepted: (data) => {
      if (data?.orderId) {
        setPendingQueue((prev) => prev.filter((o) => o._id !== data.orderId));
      } else {
        fetchOrdersData();
      }
    },
    onDeliveryStatusUpdated: () => {
      fetchOrdersData();
    },
    onOrderCancelled: (data) => {
      if (data?.orderId) {
        setPendingQueue((prev) => prev.filter((o) => o._id !== data.orderId));
      }
      fetchOrdersData();
    },
    onOrderDelivered: () => {
      fetchOrdersData();
    },
    onReconnect: () => {
      fetchOrdersData();
    },
  });

  const handleAccept = async (orderId: string) => {
    setActioningId(orderId);
    try {
      const res = await apiClient.post("/delivery/accept", { orderId });
      if (res.data.success) {
        alert("Delivery task claimed successfully!");
        fetchOrdersData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to accept order");
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (orderId: string) => {
    if (!confirm("Are you sure you want to reject this request?")) return;
    setActioningId(orderId);
    try {
      const res = await apiClient.post("/delivery/reject", { orderId });
      if (res.data.success) {
        alert("Order rejected.");
        fetchOrdersData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to reject order");
    } finally {
      setActioningId(null);
    }
  };

  const handleDeliver = async (orderId: string) => {
    setActioningId(orderId);
    try {
      const res = await apiClient.post("/delivery/deliver", { orderId });
      if (res.data.success) {
        alert("Delivery completed! Payout of ₹45 credited.");
        fetchOrdersData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to deliver order");
    } finally {
      setActioningId(null);
    }
  };

  const getItemsSummary = (items: any[], orderType: string) => {
    if (!items || items.length === 0) return "Items loaded";
    return items.map(item => {
      const name = orderType === 'food' ? item.menuItem?.name : item.groceryItem?.name;
      return `${item.quantity}x ${name || 'Item'}`;
    }).join(', ');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <MdSync className="text-[40px] text-emerald-600 animate-spin" />
        <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Fulfilling orders...</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto flex flex-col gap-6 pt-6 relative">
      <div className="flex flex-col">
        <h1 className="text-[22px] font-black text-slate-800 leading-none">ORDER DISPATCH</h1>
        <p className="text-slate-400 text-xs font-bold mt-1.5 uppercase tracking-wide">Manage assignments and claim pending orders</p>
      </div>

      {/* SECTION 1: ACTIVE ASSIGNMENTS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-black text-slate-700 uppercase tracking-widest">Active Tasks ({activeTasks.length})</h2>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>

        {activeTasks.length === 0 ? (
          <div className="bg-white rounded-[24px] p-6 border border-slate-100/80 shadow-sm text-center py-10">
            <MdTask className="text-[36px] text-slate-300 mx-auto" />
            <p className="text-slate-400 text-xs font-bold leading-relaxed mt-2">No active tasks assigned.</p>
            <p className="text-[11px] text-slate-350 font-medium leading-relaxed">Claim unclaimed requests from the dispatcher queue below.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeTasks.map((delivery) => {
              const order = delivery.order;
              if (!order) return null;
              const orderId = `#ORD-${order._id.substring(order._id.length - 6).toUpperCase()}`;
              return (
                <div key={delivery._id} className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100 flex flex-col gap-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[9px] font-bold rounded-lg uppercase tracking-wider mb-2">
                        Courier Duty • {order.orderType === 'food' ? 'Restaurant Pick' : 'Grocery Depot'}
                      </span>
                      <h3 className="text-[17px] font-black text-slate-800 leading-tight">{orderId}</h3>
                      <p className="text-slate-400 text-xs font-semibold mt-1">{getItemsSummary(order.items, order.orderType)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-[#FF5C00]">₹{order.totalAmount}</p>
                      <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider mt-1.5 ${
                        order.paymentMethod === 'ONLINE'
                          ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                          : 'text-amber-700 bg-amber-50 border border-amber-100'
                      }`}>
                        {order.paymentMethod}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-50 pt-3 space-y-2 text-xs font-semibold">
                    <div className="flex gap-2.5 items-start w-full justify-between">
                      <div className="flex gap-2.5 items-start">
                        <MdStore className="text-slate-400 text-[16px] mt-0.5 shrink-0" />
                        <div>
                          <p className="text-slate-800 font-bold">Pick Up Location</p>
                          <p className="text-slate-500 font-medium">{order.restaurant?.name || "ZipGrocery Hyperlocal Depot"}</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">{order.restaurant?.address || "Fulfillment Center"}</p>
                        </div>
                      </div>
                      {(order.restaurant?.location?.lat !== undefined || order.deliveryZone?.center?.lat !== undefined) && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${order.orderType === 'food' ? order.restaurant?.location?.lat : order.deliveryZone?.center?.lat},${order.orderType === 'food' ? order.restaurant?.location?.lng : order.deliveryZone?.center?.lng}&travelmode=driving`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-600 transition-colors shadow-sm ml-2 shrink-0 self-center"
                          title="Navigate to Pick Up"
                        >
                          <MdNavigation className="text-[16px]" />
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2.5 items-start w-full justify-between">
                      <div className="flex gap-2.5 items-start">
                        <MdLocationOn className="text-slate-400 text-[16px] mt-0.5 shrink-0" />
                        <div>
                          <p className="text-slate-800 font-bold">Delivery Destination</p>
                          <p className="text-slate-500 font-medium">{order.address?.fullAddress || "Address details hidden"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 self-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyAddress(order.address?.fullAddress || "");
                          }}
                          className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors shadow-sm ml-1"
                          title="Copy Customer Address"
                        >
                          <MdContentCopy className="text-[16px]" />
                        </button>
                        {order.address?.lat !== undefined && (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${order.address.lat},${order.address.lng}&travelmode=driving`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-600 transition-colors shadow-sm ml-1"
                            title="Navigate to Destination"
                          >
                            <MdNavigation className="text-[16px]" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <a
                      href={`tel:${order.user?.phone || '9999999999'}`}
                      className="flex items-center justify-center gap-1.5 py-3 border border-slate-250 hover:bg-slate-50 text-slate-600 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 text-center"
                    >
                      <MdCall className="text-[16px]" />
                      Call client
                    </a>
                    <button
                      onClick={() => handleDeliver(order._id)}
                      disabled={actioningId === order._id}
                      className="flex items-center justify-center gap-1.5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95"
                    >
                      <MdCheckCircle className="text-[16px]" />
                      Delivered
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: DISPATCHER QUEUE */}
      <div className="space-y-4">
        <h2 className="text-[14px] font-black text-slate-700 uppercase tracking-widest">Unclaimed Queue ({pendingQueue.length})</h2>

        {pendingQueue.length === 0 ? (
          <div className="bg-white rounded-[24px] p-6 border border-slate-100/80 shadow-sm text-center py-10">
            <MdExplore className="text-[36px] text-slate-350 animate-pulse mx-auto" />
            <p className="text-slate-400 text-xs font-bold leading-relaxed mt-2">Dispatcher queue is empty.</p>
            <p className="text-[11px] text-slate-350 font-medium leading-relaxed">New hyper-local grocery and restaurant orders will show up here instantly!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingQueue.map((order) => {
              const orderId = `#ORD-${order._id.substring(order._id.length - 6).toUpperCase()}`;
              return (
                <div key={order._id} className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100 flex flex-col gap-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="inline-block px-2.5 py-1 bg-amber-50 text-amber-700 text-[9px] font-bold rounded-lg uppercase tracking-wider mb-2">
                        UNCLAIMED REQUEST • {order.orderType.toUpperCase()}
                      </span>
                      <h3 className="text-[17px] font-black text-slate-800 leading-tight">{orderId}</h3>
                      <p className="text-slate-400 text-xs font-semibold mt-1">{getItemsSummary(order.items, order.orderType)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-[#FF5C00]">₹{order.totalAmount}</p>
                      <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider mt-1.5 ${
                        order.paymentMethod === 'ONLINE'
                          ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                          : 'text-amber-700 bg-amber-50 border border-amber-100'
                      }`}>
                        {order.paymentMethod}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-50 pt-3 space-y-2 text-xs font-semibold">
                    <div className="flex gap-2.5 items-start w-full justify-between">
                      <div className="flex gap-2.5 items-start">
                        <MdStore className="text-slate-400 text-[16px] mt-0.5 shrink-0" />
                        <div>
                          <p className="text-slate-800 font-bold">Pick Up Location</p>
                          <p className="text-slate-500 font-medium">{order.restaurant?.name || "ZipGrocery Hyperlocal Depot"}</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">{order.restaurant?.address || "Fulfillment Center"}</p>
                        </div>
                      </div>
                      {(order.restaurant?.location?.lat !== undefined || order.deliveryZone?.center?.lat !== undefined) && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${order.orderType === 'food' ? order.restaurant?.location?.lat : order.deliveryZone?.center?.lat},${order.orderType === 'food' ? order.restaurant?.location?.lng : order.deliveryZone?.center?.lng}&travelmode=driving`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-600 transition-colors shadow-sm ml-2 shrink-0 self-center"
                          title="Navigate to Pick Up"
                        >
                          <MdNavigation className="text-[16px]" />
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2.5 items-start w-full justify-between">
                      <div className="flex gap-2.5 items-start">
                        <MdLocationOn className="text-slate-400 text-[16px] mt-0.5 shrink-0" />
                        <div>
                          <p className="text-slate-800 font-bold">Delivery Destination</p>
                          <p className="text-slate-500 font-medium">{order.address?.fullAddress || "Customer address details hidden"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 self-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyAddress(order.address?.fullAddress || "");
                          }}
                          className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors shadow-sm ml-1"
                          title="Copy Customer Address"
                        >
                          <MdContentCopy className="text-[16px]" />
                        </button>
                        {order.address?.lat !== undefined && (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${order.address.lat},${order.address.lng}&travelmode=driving`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-600 transition-colors shadow-sm ml-1"
                            title="Navigate to Destination"
                          >
                            <MdNavigation className="text-[16px]" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <button
                      onClick={() => handleReject(order._id)}
                      disabled={actioningId === order._id}
                      className="flex items-center justify-center gap-1.5 py-3 border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95"
                    >
                      <MdClose className="text-[16px]" />
                      Reject
                    </button>
                    <button
                      onClick={() => handleAccept(order._id)}
                      disabled={actioningId === order._id}
                      className="flex items-center justify-center gap-1.5 py-3 bg-[#FF5C00] hover:bg-[#e05200] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95"
                    >
                      <MdCheck className="text-[16px]" />
                      Claim Task
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
