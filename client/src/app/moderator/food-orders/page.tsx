"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ModeratorHeader from "@/components/moderator/ModeratorHeader";
import { usePendingFoodOrders } from "@/hooks/useOrders";
import { useOrderSocket } from "@/hooks/useOrderSocket";
import {
  MdRestaurant,
  MdPhone,
  MdAccessTime,
  MdWarning,
  MdCheckCircle,
  MdRefresh,
  MdSearch,
  MdLocationOn,
  MdReceiptLong,
  MdOutlineCall,
  MdOutlineFastfood,
  MdFlashOn,
} from "react-icons/md";

interface PendingFoodOrder {
  _id: string;
  orderType: "food";
  restaurant?: {
    _id: string;
    name: string;
    phone?: string;
  };
  items: {
    menuItem?: {
      _id: string;
      name: string;
    };
    name?: string;
    quantity: number;
    price: number;
  }[];
  totalAmount: number;
  deliveryCharge: number;
  paymentMethod: "COD" | "ONLINE";
  paymentStatus: "pending" | "paid" | "failed";
  orderStatus: "placed" | "accepted" | "preparing" | "accepted_by_delivery" | "on_the_way" | "delivered" | "cancelled";
  address?: {
    fullAddress: string;
  };
  deliveryZone?: {
    _id: string;
    name: string;
  };
  createdAt: string;
}

const URGENT_THRESHOLD_SECONDS = 300; // 5 minutes

export default function PendingFoodOrdersPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, refetch } = usePendingFoodOrders();
  const orders: PendingFoodOrder[] = data?.orders ?? [];

  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUrgentOnly, setFilterUrgentOnly] = useState(false);

  // Live timer tick every second to recompute elapsed durations
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to invalidate / refetch pending food orders
  const invalidatePendingOrders = () => {
    queryClient.invalidateQueries({ queryKey: ["orders", "pending-food"] });
  };

  // Socket real-time updates for immediate UI changes
  useOrderSocket({
    onNewOrder: (socketData) => {
      const order = socketData?.order || socketData;
      const orderType = socketData?.orderType || order?.orderType;

      if (orderType === "food") {
        queryClient.setQueryData(["orders", "pending-food"], (prev: any) => {
          if (!prev) return prev;
          const prevOrders: PendingFoodOrder[] = prev.orders ?? [];
          if (prevOrders.some((o) => o._id === order._id)) return prev;

          // Normalize items if needed
          const normalizedOrder = {
            ...order,
            items: (order.items || []).map((item: any) => ({
              ...item,
              name: item.name || item.menuItem?.name || "Item",
            })),
          };

          return {
            ...prev,
            orders: [normalizedOrder, ...prevOrders],
            count: (prev.count ?? prevOrders.length) + 1,
          };
        });
        invalidatePendingOrders();
      }
    },
    onOrderStatusUpdated: (socketData) => {
      if (socketData?.orderId) {
        // If the order status is anything other than "placed" (e.g. accepted, preparing, cancelled),
        // remove it from the pending needs attention list immediately.
        if (socketData.orderStatus !== "placed") {
          queryClient.setQueryData(["orders", "pending-food"], (prev: any) => {
            if (!prev) return prev;
            const prevOrders: PendingFoodOrder[] = prev.orders ?? [];
            const updated = prevOrders.filter((o) => o._id !== socketData.orderId);
            return {
              ...prev,
              orders: updated,
              count: updated.length,
            };
          });
        }
        invalidatePendingOrders();
      }
    },
    onOrderCancelled: (socketData) => {
      if (socketData?.orderId) {
        queryClient.setQueryData(["orders", "pending-food"], (prev: any) => {
          if (!prev) return prev;
          const prevOrders: PendingFoodOrder[] = prev.orders ?? [];
          const updated = prevOrders.filter((o) => o._id !== socketData.orderId);
          return {
            ...prev,
            orders: updated,
            count: updated.length,
          };
        });
        invalidatePendingOrders();
      }
    },
    onReconnect: () => {
      invalidatePendingOrders();
    },
  });

  // Calculate elapsed time details
  const getElapsedInfo = (createdAt: string) => {
    const createdMs = new Date(createdAt).getTime();
    const elapsedMs = Math.max(0, currentTime - createdMs);
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const isUrgent = totalSeconds >= URGENT_THRESHOLD_SECONDS;
    const formatted =
      minutes > 0 ? `${minutes}m ${seconds}s ago` : `${seconds}s ago`;

    return { totalSeconds, minutes, seconds, isUrgent, formatted };
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const elapsed = getElapsedInfo(order.createdAt);
    if (filterUrgentOnly && !elapsed.isUrgent) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const restaurantName = order.restaurant?.name?.toLowerCase() || "";
    const phone = order.restaurant?.phone?.toLowerCase() || "";
    const orderId = order._id.toLowerCase();
    const zoneName = order.deliveryZone?.name?.toLowerCase() || "";

    return (
      restaurantName.includes(q) ||
      phone.includes(q) ||
      orderId.includes(q) ||
      zoneName.includes(q)
    );
  });

  const urgentCount = orders.filter(
    (o) => getElapsedInfo(o.createdAt).isUrgent
  ).length;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50">
      <ModeratorHeader title="Pending Food Orders — Needs Attention" />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
        {/* Top Summary & Alert Banner */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                <MdRestaurant className="text-[22px]" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Unaccepted Food Orders
                  {orders.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                      {orders.length}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Food orders waiting for restaurant confirmation in your assigned zones. Sorted oldest-first.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            {urgentCount > 0 && (
              <div className="flex items-center gap-2 px-3.5 py-2 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-2xl text-xs font-black animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>{urgentCount} URGENT (&gt;5m)</span>
              </div>
            )}

            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-all active:scale-95 disabled:opacity-50"
            >
              <MdRefresh
                className={`text-[16px] ${isFetching ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <MdSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]" />
            <input
              type="text"
              placeholder="Search by restaurant, phone, order ID, zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200/80 rounded-2xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterUrgentOnly(false)}
              className={`px-4 py-2 rounded-2xl font-bold text-xs transition-all ${
                !filterUrgentOnly
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50"
              }`}
            >
              All Pending ({orders.length})
            </button>
            <button
              onClick={() => setFilterUrgentOnly(true)}
              className={`px-4 py-2 rounded-2xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                filterUrgentOnly
                  ? "bg-rose-600 text-white shadow-sm shadow-rose-600/20"
                  : "bg-white text-rose-600 border border-rose-200 hover:bg-rose-50"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              <span>Urgent Only ({urgentCount})</span>
            </button>
          </div>
        </div>

        {/* Orders List / States */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white rounded-3xl border border-slate-100 p-6 space-y-4 shadow-xs animate-pulse h-64"
              >
                <div className="h-6 bg-slate-100 rounded-lg w-3/4" />
                <div className="h-4 bg-slate-100 rounded-md w-1/2" />
                <div className="h-16 bg-slate-50 rounded-xl" />
                <div className="h-10 bg-slate-100 rounded-2xl w-full" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          /* Positive Framing Empty State */
          <div className="bg-white border border-emerald-100 rounded-3xl p-10 sm:p-14 text-center max-w-2xl mx-auto shadow-xs space-y-4">
            <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-4xl shadow-inner border border-emerald-100">
              🎉
            </div>
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                No orders waiting on restaurant confirmation right now 🎉
              </h3>
              <p className="text-sm text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
                All food orders in your assigned zones have been confirmed by restaurants or dispatched. We’ll alert you in real-time if a restaurant delays accepting an order!
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50/80 px-4 py-2 rounded-2xl w-fit mx-auto border border-emerald-200/60">
              <MdCheckCircle className="text-[18px] text-emerald-600" />
              <span>Live Socket Monitoring Active</span>
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          /* Filter Empty State */
          <div className="bg-white border border-slate-200/80 rounded-3xl p-10 text-center max-w-md mx-auto shadow-xs space-y-3">
            <MdSearch className="text-4xl text-slate-300 mx-auto" />
            <h4 className="text-base font-bold text-slate-800">No matching orders</h4>
            <p className="text-xs text-slate-500">
              No pending orders match your search query or urgent filter.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setFilterUrgentOnly(false);
              }}
              className="text-xs font-bold text-emerald-600 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          /* Grid of Pending Food Order Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredOrders.map((order) => {
              const elapsed = getElapsedInfo(order.createdAt);
              const restaurantPhone = order.restaurant?.phone;
              const isUrgent = elapsed.isUrgent;

              return (
                <div
                  key={order._id}
                  className={`bg-white rounded-3xl border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                    isUrgent
                      ? "border-rose-500 ring-2 ring-rose-500/20 shadow-rose-500/10"
                      : "border-slate-200/80 hover:border-slate-300"
                  }`}
                >
                  {/* Card Header & Urgency Banner */}
                  <div>
                    {isUrgent ? (
                      <div className="bg-rose-500 text-white px-4 py-2 flex items-center justify-between text-xs font-black tracking-wide animate-pulse">
                        <div className="flex items-center gap-1.5">
                          <MdWarning className="text-[16px]" />
                          <span>🔴 URGENT — Call Restaurant</span>
                        </div>
                        <span className="font-mono bg-rose-700/80 px-2 py-0.5 rounded-md text-[11px]">
                          {elapsed.formatted}
                        </span>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border-b border-amber-100 text-amber-800 px-4 py-2 flex items-center justify-between text-xs font-bold">
                        <div className="flex items-center gap-1.5">
                          <MdAccessTime className="text-[15px] text-amber-600" />
                          <span>Waiting for Confirmation</span>
                        </div>
                        <span className="font-mono bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md text-[11px] font-bold">
                          {elapsed.formatted}
                        </span>
                      </div>
                    )}

                    <div className="p-5 space-y-4">
                      {/* Restaurant Details & Click to Call */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                              Restaurant
                            </span>
                            {order.deliveryZone?.name && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md truncate max-w-[120px]">
                                {order.deliveryZone.name}
                              </span>
                            )}
                          </div>
                          <h3 className="font-black text-slate-900 text-base leading-tight truncate">
                            {order.restaurant?.name || "Unknown Restaurant"}
                          </h3>
                        </div>

                        {/* Order Amount */}
                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-slate-400 block leading-none">
                            Total
                          </span>
                          <span className="text-base font-black text-slate-900">
                            ₹{order.totalAmount}
                          </span>
                        </div>
                      </div>

                      {/* Click to Call Action Button */}
                      {restaurantPhone ? (
                        <a
                          href={`tel:${restaurantPhone}`}
                          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-black text-sm transition-all shadow-xs active:scale-95 ${
                            isUrgent
                              ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20 animate-bounce"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                          }`}
                        >
                          <MdOutlineCall className="text-[18px]" />
                          <span>Call Restaurant: {restaurantPhone}</span>
                        </a>
                      ) : (
                        <div className="w-full text-center py-2.5 px-3 bg-slate-100 rounded-2xl text-xs font-bold text-slate-500">
                          No phone number on file
                        </div>
                      )}

                      {/* Order Items Breakdown */}
                      <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                          <span className="flex items-center gap-1">
                            <MdOutlineFastfood className="text-[14px]" /> Items (
                            {order.items?.reduce((acc, it) => acc + (it.quantity || 1), 0) || 0})
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            #{order._id.slice(-6)}
                          </span>
                        </div>
                        <ul className="divide-y divide-slate-200/60 text-xs space-y-1.5 pt-1">
                          {order.items?.map((item, idx) => (
                            <li
                              key={idx}
                              className="pt-1.5 first:pt-0 flex items-center justify-between font-medium text-slate-700"
                            >
                              <span className="truncate pr-2">
                                <span className="font-extrabold text-slate-900">
                                  {item.quantity}x
                                </span>{" "}
                                {item.name || item.menuItem?.name || "Item"}
                              </span>
                              <span className="font-bold text-slate-900 shrink-0">
                                ₹{item.price * item.quantity}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Delivery Address & Details */}
                      {order.address?.fullAddress && (
                        <div className="flex items-start gap-1.5 text-xs text-slate-500">
                          <MdLocationOn className="text-[16px] text-slate-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-1 font-medium">
                            {order.address.fullAddress}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase ${
                          order.paymentMethod === "ONLINE"
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        }`}
                      >
                        {order.paymentMethod}
                      </span>
                      <span
                        className={`text-[10px] font-bold ${
                          order.paymentStatus === "paid"
                            ? "text-emerald-600"
                            : "text-amber-600"
                        }`}
                      >
                        {order.paymentStatus.toUpperCase()}
                      </span>
                    </div>

                    <span className="font-mono text-slate-400 text-[10px]">
                      {new Date(order.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
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
