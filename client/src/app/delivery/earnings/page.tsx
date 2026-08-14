"use client";

import { useState, useEffect } from "react";
import { apiClient } from "../../../services/api";
import {
  MdSync,
  MdPayments,
  MdPaid,
  MdCalendarToday,
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

interface DailyEarningGroup {
  dateString: string;
  count: number;
  earnings: number;
  deliveries: DeliveryRecord[];
}

export default function DeliveryEarningsPage() {
  const [completedDeliveries, setCompletedDeliveries] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<any>(null);

  const fetchEarningsData = async () => {
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
      console.error("Failed to load delivery earnings page data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEarningsData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <MdSync className="text-[40px] text-emerald-600 animate-spin" />
        <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Compiling Statement...</p>
      </div>
    );
  }

  // Calculate metrics
  const netEarnings = completedDeliveries.reduce((sum, del) => sum + (del.earnings || 45), 0);
  const totalDeliveries = completedDeliveries.length;

  // Group deliveries by day
  const groupEarningsByDay = (): DailyEarningGroup[] => {
    const groups: { [key: string]: DeliveryRecord[] } = {};
    
    completedDeliveries.forEach(del => {
      const date = new Date(del.createdAt);
      const dateKey = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(del);
    });

    return Object.keys(groups).map(dateString => {
      const deliveries = groups[dateString];
      const earnings = deliveries.reduce((sum, d) => sum + (d.earnings || 45), 0);
      return {
        dateString,
        count: deliveries.length,
        earnings,
        deliveries
      };
    });
  };

  const dailyGroups = groupEarningsByDay();

  return (
    <div className="p-4 max-w-2xl mx-auto flex flex-col gap-6 pt-6 relative">
      <div className="flex flex-col">
        <h1 className="text-[22px] font-black text-slate-800 leading-none">EARNINGS PANEL</h1>
        <p className="text-slate-400 text-xs font-bold mt-1.5 uppercase tracking-wide">Track payouts, daily summaries, and direct deposits</p>
      </div>

      {/* PREMIUM PAYOUT CARD */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[28px] p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-4 translate-y-4">
          <MdPayments className="text-[180px] select-none" />
        </div>

        <div className="relative z-10 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-lg">
              Courier Account Payout
            </span>
            <span className="flex items-center gap-1 text-[11px] font-bold text-teal-100">
              <span className="h-1.5 w-1.5 bg-emerald-300 rounded-full animate-pulse"></span>
              Bank Linked
            </span>
          </div>

          <div className="pt-2">
            <span className="text-[11px] font-bold text-teal-100 uppercase tracking-widest block mb-1">Unsettled Balance</span>
            <div className="flex items-baseline gap-1">
              <span className="text-[36px] font-black leading-none">₹{netEarnings.toLocaleString()}</span>
              <span className="text-[14px] font-bold text-teal-100">INR</span>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-between items-center text-xs">
            <div>
              <p className="text-teal-200 text-[10px] font-bold uppercase tracking-wider">Settlement Cycle</p>
              <p className="font-extrabold text-[13px] mt-0.5">Weekly Auto-Deposit</p>
            </div>
            <div className="text-right">
              <p className="text-teal-200 text-[10px] font-bold uppercase tracking-wider">Next Payout</p>
              <p className="font-extrabold text-[13px] mt-0.5">Wednesday, 09:00 AM</p>
            </div>
          </div>
        </div>
      </div>

      {/* METRICS STATS */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-[20px] p-4 border border-slate-100/80 shadow-sm text-center">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Trips</span>
          <span className="text-[18px] font-black text-slate-800">{totalDeliveries}</span>
        </div>
        <div className="bg-white rounded-[20px] p-4 border border-slate-100/80 shadow-sm text-center">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Trip Average</span>
          <span className="text-[18px] font-black text-emerald-600">₹45</span>
        </div>
        <div className="bg-white rounded-[20px] p-4 border border-slate-100/80 shadow-sm text-center">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Status</span>
          <span className="text-[12px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg mt-1 inline-block uppercase tracking-wider">Active</span>
        </div>
      </div>

      {/* DAILY STATEMENT BREAKDOWN */}
      <div className="space-y-4">
        <h2 className="text-[14px] font-black text-slate-700 uppercase tracking-widest">Daily Statement</h2>

        {dailyGroups.length === 0 ? (
          <div className="bg-white rounded-[24px] p-10 border border-slate-100 shadow-sm text-center py-16">
            <MdPaid className="text-[48px] text-slate-300 mb-3 mx-auto" />
            <h3 className="font-extrabold text-slate-700 text-[16px] leading-none">No Earnings Recorded</h3>
            <p className="text-slate-400 text-xs font-semibold max-w-[240px] mx-auto leading-relaxed mt-2">
              Deliveries will log and calculate payouts dynamically here on a daily cycle basis.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {dailyGroups.map((group) => (
              <div key={group.dateString} className="bg-white rounded-[20px] p-4 border border-slate-100 shadow-sm flex items-center justify-between animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                    <MdCalendarToday className="text-[20px]" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[14px] text-slate-800 leading-tight">{group.dateString}</h3>
                    <p className="text-slate-400 text-[11px] font-bold mt-0.5 uppercase tracking-wide">
                      {group.count} {group.count === 1 ? 'trip completed' : 'trips completed'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[16px] font-black text-slate-850">₹{group.earnings}</span>
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block mt-0.5">Approved</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
