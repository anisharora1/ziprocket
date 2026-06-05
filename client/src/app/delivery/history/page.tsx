"use client";

import { useState, useEffect } from "react";
import { apiClient } from "../../../services/api";

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
  };
  orderType: "food" | "grocery";
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: "COD" | "ONLINE";
  paymentStatus: "pending" | "paid" | "failed";
  orderStatus: string;
  address: {
    fullAddress: string;
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

export default function DeliveryHistoryPage() {
  const [completedDeliveries, setCompletedDeliveries] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<any>(null);

  const fetchHistoryData = async () => {
    try {
      const [historyRes, profileRes] = await Promise.all([
        apiClient.get("/delivery/my-deliveries?type=completed"),
        apiClient.get("/delivery/profile/my-profile")
      ]);

      if (historyRes.data.success) {
        setCompletedDeliveries(historyRes.data.deliveries || []);
      }
      if (profileRes.data.success) {
        setProfile(profileRes.data.profile);
      }
    } catch (err) {
      console.error("Failed to load delivery history page data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoryData();
  }, []);

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
        <span className="material-symbols-outlined text-[40px] text-emerald-600 animate-spin">sync</span>
        <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Loading Logs...</p>
      </div>
    );
  }

  // Aggregate metrics
  const totalEarnings = completedDeliveries.reduce((sum, del) => sum + (del.earnings || 45), 0);

  return (
    <div className="p-4 max-w-2xl mx-auto flex flex-col gap-6 pt-6 relative">
      <div className="flex flex-col">
        <h1 className="text-[22px] font-black text-slate-800 leading-none">DELIVERY HISTORY</h1>
        <p className="text-slate-400 text-xs font-bold mt-1.5 uppercase tracking-wide">Browse your completed drop-offs and settlements</p>
      </div>

      {/* TIMELINE METRIC SUMMARY CARDS */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-[20px] p-4 border border-slate-100/80 shadow-sm flex flex-col gap-1.5">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none">Total Earnings</span>
          <span className="text-[24px] font-black text-emerald-600">₹{totalEarnings.toLocaleString()}</span>
          <span className="text-[10px] text-slate-400 font-bold mt-0.5">₹45 flat rate per order</span>
        </div>
        <div className="bg-white rounded-[20px] p-4 border border-slate-100/80 shadow-sm flex flex-col gap-1.5">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none">Delivered Tasks</span>
          <span className="text-[24px] font-black text-slate-800">{completedDeliveries.length} Drop-offs</span>
          <span className="text-[10px] text-slate-400 font-bold mt-0.5">Rating: {profile?.rating || "5.0"} ★</span>
        </div>
      </div>

      {/* COMPLETED TIMELINE LIST */}
      <div className="space-y-4">
        <h2 className="text-[14px] font-black text-slate-700 uppercase tracking-widest">Completed Timeline</h2>

        {completedDeliveries.length === 0 ? (
          <div className="bg-white rounded-[24px] p-10 border border-slate-100 shadow-sm text-center py-16">
            <span className="material-symbols-outlined text-[48px] text-slate-300 mb-3">history</span>
            <h3 className="font-extrabold text-slate-700 text-[16px] leading-none">No History Found</h3>
            <p className="text-slate-400 text-xs font-semibold max-w-[240px] mx-auto leading-relaxed mt-2">
              All successful deliveries and payments collected on doorstep will be logged here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {completedDeliveries.map((delivery) => {
              const order = delivery.order;
              if (!order) return null;
              const orderId = `#ORD-${order._id.substring(order._id.length - 6).toUpperCase()}`;
              return (
                <div key={delivery._id} className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.01)] flex flex-col gap-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-start pb-3 border-b border-slate-50">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg flex items-center gap-1 self-start">
                        <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        SUCCESSFUL DROP-OFF
                      </span>
                      <h3 className="font-black text-[15px] text-slate-800 leading-tight mt-1">{orderId}</h3>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">
                      {new Date(delivery.createdAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-semibold text-slate-600">
                    <div className="flex gap-2.5 items-start">
                      <span className="material-symbols-outlined text-slate-400 text-[16px] mt-0.5">store</span>
                      <div>
                        <span className="font-bold text-slate-800">Picked From:</span> {order.restaurant?.name || "Grocery Store Hub"}
                      </div>
                    </div>
                    <div className="flex gap-2.5 items-start">
                      <span className="material-symbols-outlined text-slate-400 text-[16px] mt-0.5">location_on</span>
                      <div>
                        <span className="font-bold text-slate-800">Delivered To:</span> {order.address?.fullAddress || "Customer Destination"}
                      </div>
                    </div>
                    <div className="flex gap-2.5 items-start">
                      <span className="material-symbols-outlined text-slate-400 text-[16px] mt-0.5">shopping_bag</span>
                      <div>
                        <span className="font-bold text-slate-800">Basket:</span> {getItemsSummary(order.items, order.orderType)}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-50 flex items-center justify-between text-xs">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Settlement Credit</span>
                      <span className="font-extrabold text-emerald-600 text-base">+₹{delivery.earnings || 45}</span>
                    </div>
                    <span className={`inline-block px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                      order.paymentMethod === 'ONLINE'
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                        : 'text-amber-700 bg-amber-50 border border-amber-100'
                    }`}>
                      {order.paymentMethod === 'ONLINE' ? 'ONLINE • PAID' : 'COD • PAID'}
                    </span>
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
