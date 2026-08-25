"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/api";
import { useSocket } from "@/context/SocketContext";
import Link from "next/link";
import { 
  MdRefresh, 
  MdInventory2, 
  MdTrendingUp, 
  MdPayments, 
  MdGroups, 
  MdExplore, 
  MdMap, 
  MdLocationOn, 
  MdAdminPanelSettings, 
  MdCreditCard, 
  MdError,
  MdSecurity,
  MdWarning,
  MdBlock,
  MdOpenInNew
} from "react-icons/md";

interface Stats {
  totalUsers: number;
  totalRestaurants: number;
  totalDeliveries: number;
  totalOrders: number;
  onlinePaymentsCount: number;
  codOrdersCount: number;
  failedPaymentsCount: number;
  totalRevenue: number;
  onlineRevenue: number;
  codRevenue: number;
  zoneAnalytics?: any[];
}

export default function AdminDashboard() {
  const { socket } = useSocket();
  const [liveUserCount, setLiveUserCount] = useState<number | null>(null);
  const [stats, setStats] = useState<Stats>({ 
    totalUsers: 0, 
    totalRestaurants: 0, 
    totalDeliveries: 0, 
    totalOrders: 0,
    onlinePaymentsCount: 0,
    codOrdersCount: 0,
    failedPaymentsCount: 0,
    totalRevenue: 0,
    onlineRevenue: 0,
    codRevenue: 0
  });
  const [orders, setOrders] = useState<any[]>([]);
  const [flaggedRestaurants, setFlaggedRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, ordersRes, flaggedRes, liveUsersRes] = await Promise.all([
        apiClient.get("/admin/dashboard-stats"),
        apiClient.get("/orders"),
        apiClient.get("/admin/cancellations/restaurants", { params: { threshold: 5 } }).catch(() => ({ data: { success: false, restaurants: [] } })),
        apiClient.get("/admin/live-users-count").catch(() => ({ data: { success: false, count: 0 } }))
      ]);

      if (statsRes.data.success) {
        setStats(statsRes.data.stats);
      }

      if (ordersRes.data.success) {
        // Sort orders by newest first and take top 10
        const sortedOrders = ordersRes.data.orders
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10);
        setOrders(sortedOrders);
      }

      if (flaggedRes.data?.success) {
        setFlaggedRestaurants(flaggedRes.data.restaurants || []);
      }

      if (liveUsersRes.data?.success) {
        setLiveUserCount(liveUsersRes.data.count);
      }
    } catch (error) {
      console.error("Failed to fetch admin dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendRestaurant = async (id: string) => {
    try {
      const res = await apiClient.patch(`/restaurants/${id}/status`, {
        isBlocked: true
      });
      if (res.data.success) {
        setFlaggedRestaurants(prev => prev.map(r => r._id === id ? { ...r, isBlocked: true } : r));
      }
    } catch (error) {
      console.error("Failed to suspend restaurant:", error);
      alert("Failed to suspend restaurant.");
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Refresh stats every 5 seconds for a dynamic real-time experience if active
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchDashboardData();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleLiveUserCount = (data: { count: number }) => {
      setLiveUserCount(data.count);
    };
    socket.on("live_user_count", handleLiveUserCount);
    return () => {
      socket.off("live_user_count", handleLiveUserCount);
    };
  }, [socket]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'preparing': return 'bg-orange-100 text-orange-700';
      case 'ready': return 'bg-blue-100 text-blue-700';
      case 'out_for_delivery': return 'bg-indigo-100 text-indigo-700';
      case 'delivered': return 'bg-emerald-100 text-emerald-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const formatStatus = (status: string) => {
    if (!status) return "Placed";
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 md:space-y-8 bg-[#fafafa] min-h-screen">
      
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-[#FF5C00] uppercase mb-1 sm:mb-2">Real-time Monitoring</p>
          <h2 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight leading-none font-sans">Logistics Dashboard</h2>
        </div>
        <button 
          onClick={fetchDashboardData}
          className="flex items-center justify-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-[13px] font-semibold text-slate-700 shadow-sm hover:border-[#FF5C00] hover:text-[#FF5C00] transition-colors self-start sm:self-auto"
        >
          <MdRefresh className="text-[16px]" />
          Refresh Stats
        </button>
      </div>

      {/* Fraud Watch Panel (Only rendered when count > 0) */}
      {flaggedRestaurants.length > 0 && (
        <div className="bg-white border-2 border-rose-200 rounded-2xl p-5 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-rose-100">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-sm shadow-rose-500/30">
                <MdSecurity className="text-[18px]" />
              </span>
              <div>
                <h3 className="text-[16px] font-bold text-slate-900 flex items-center gap-2">
                  Fraud Watch
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500 text-white tracking-wider">
                    {flaggedRestaurants.length} Flagged
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Restaurants with ≥ 5 order cancellations requiring administrator review
                </p>
              </div>
            </div>
            <Link
              href="/admin/restaurants"
              className="text-xs font-bold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1 self-start sm:self-auto"
            >
              All Restaurants
              <MdOpenInNew className="text-[14px]" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {flaggedRestaurants.map((restaurant) => (
              <div key={restaurant._id} className="py-3 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 font-bold text-sm shadow-sm flex-shrink-0">
                    <MdWarning className="text-[18px]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900">{restaurant.name}</span>
                      {restaurant.isBlocked && (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 px-2 py-0.5 rounded">
                          Suspended
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Owner Phone: <span className="font-semibold text-slate-700">+91 {restaurant.phone || restaurant.owner?.phone || "N/A"}</span>
                      {restaurant.ownerName || restaurant.owner?.name ? ` • ${restaurant.ownerName || restaurant.owner?.name}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end md:self-center">
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block leading-none">Cancellations</span>
                    <span className="text-base font-black text-rose-600 leading-tight">
                      {restaurant.cancellationCount}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSuspendRestaurant(restaurant._id)}
                      disabled={restaurant.isBlocked}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs inline-flex items-center gap-1 transition-colors ${
                        restaurant.isBlocked
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-500/20"
                      }`}
                    >
                      <MdBlock className="text-[14px]" />
                      {restaurant.isBlocked ? "Suspended" : "Suspend"}
                    </button>

                    <Link
                      href="/admin/restaurants"
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs transition-colors shadow-sm inline-flex items-center gap-1"
                    >
                      View Restaurant
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        {/* Total Orders */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-[#FF5C00]">
              <MdInventory2 className="text-[20px]" />
            </div>
            <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-1 rounded text-[11px] font-bold">
              <MdTrendingUp className="text-[14px]" />
              Active
            </div>
          </div>
          <p className="text-[13px] text-slate-500 font-medium mb-1">Total Orders</p>
          <h3 className="text-[28px] font-bold text-slate-900 leading-tight">
            {loading ? "..." : stats.totalOrders}
          </h3>
        </div>

        {/* Revenue */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <MdPayments className="text-[20px]" />
            </div>
            <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-1 rounded text-[11px] font-bold">
              <MdTrendingUp className="text-[14px]" />
              Settled
            </div>
          </div>
          <p className="text-[13px] text-slate-500 font-medium mb-1">Total Net Revenue</p>
          <h3 className="text-[28px] font-bold text-[#FF5C00] leading-tight">
            ₹{loading ? "..." : stats.totalRevenue.toLocaleString()}
          </h3>
        </div>

        {/* Logged-in Users Online (Live) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <MdGroups className="text-[20px]" />
            </div>
            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live
            </div>
          </div>
          <p className="text-[13px] text-slate-500 font-medium mb-1">Logged-in Users Online</p>
          <h3 className="text-[28px] font-bold text-slate-900 leading-tight">
            {liveUserCount === null ? "..." : liveUserCount}
          </h3>
        </div>

        {/* Total Registered Users */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <MdGroups className="text-[20px]" />
            </div>
            <div className="flex items-center gap-1 text-[#FF5C00] bg-orange-50 px-2 py-1 rounded text-[11px] font-bold">
              <MdTrendingUp className="text-[14px]" />
              Total
            </div>
          </div>
          <p className="text-[13px] text-slate-500 font-medium mb-1">Total Registered Users</p>
          <h3 className="text-[28px] font-bold text-slate-900 leading-tight">
            {loading ? "..." : stats.totalUsers}
          </h3>
        </div>
      </div>

      {/* Zone Logistics & Moderator Analytics Hub */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-bold text-[16px] text-slate-900 flex items-center gap-2">
              <MdExplore className="text-[#FF5C00] text-[20px]" />
              Zone Logistics & Analytics Console
            </h3>
            <p className="text-[12px] text-slate-500 mt-0.5">Performance tracking, orders count, and active grocery moderators per zone</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#FF5C00]/10 text-[#FF5C00]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5C00] animate-pulse"></span>
            {stats.zoneAnalytics?.length || 0} Service Zones Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {!stats.zoneAnalytics || stats.zoneAnalytics.length === 0 ? (
            <div className="col-span-full py-8 text-center text-slate-400 text-xs font-bold bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center">
              <MdMap className="text-[36px] text-slate-300 mb-1" />
              No active delivery zones found.
            </div>
          ) : (
            stats.zoneAnalytics.map((zone: any) => (
              <div key={zone.zoneId} className="bg-slate-50/30 hover:bg-slate-50 border border-slate-200/60 hover:border-[#FF5C00]/30 rounded-2xl p-5 transition-all shadow-sm group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                      <MdLocationOn className="text-[16px] text-slate-400 group-hover:text-[#FF5C00] transition-colors" />
                      {zone.name}
                    </h4>
                    <p className="text-[9px] font-semibold text-slate-400 mt-0.5">Radius: {zone.radiusKm} KM</p>
                  </div>
                  <span className="text-[10px] font-black bg-[#FF5C00]/10 text-[#FF5C00] px-2 py-0.5 rounded-md uppercase">
                    Active Zone
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-slate-100/80 pt-4 mt-2">
                  <div className="text-center bg-white p-2.5 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-none mb-1">Orders</p>
                    <span className="text-sm font-black text-slate-800">{zone.totalOrders}</span>
                  </div>
                  <div className="text-center bg-white p-2.5 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-none mb-1">Mods</p>
                    <span className="text-sm font-black text-slate-800 flex justify-center items-center gap-0.5">
                      <MdAdminPanelSettings className="text-[14px] text-emerald-600" />
                      {zone.activeModerators}
                    </span>
                  </div>
                  <div className="text-center bg-white p-2.5 rounded-xl border border-slate-100 col-span-1">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-none mb-1">Sales</p>
                    <span className="text-sm font-black text-emerald-600 leading-none">₹{zone.totalRevenue.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Payment Analytics Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-bold text-[16px] text-slate-900">Payment Gateway Analytics</h3>
            <p className="text-[12px] text-slate-500 mt-0.5">Real-time Razorpay settlements and COD cash flow</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#FF5C00]/10 text-[#FF5C00]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5C00] animate-pulse"></span>
            Razorpay Sandbox Enabled
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Online Payments Card */}
          <div className="bg-blue-50/40 rounded-xl p-4 border border-blue-100 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Online Payments</span>
              <MdCreditCard className="text-blue-600 text-[18px]" />
            </div>
            <div>
              <h4 className="text-2xl font-black text-slate-900">{loading ? "..." : stats.onlinePaymentsCount}</h4>
              <p className="text-[11px] font-semibold text-blue-600 mt-1">₹{loading ? "..." : stats.onlineRevenue.toLocaleString()} Share</p>
            </div>
          </div>

          {/* COD Orders Card */}
          <div className="bg-amber-50/40 rounded-xl p-4 border border-amber-100 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">COD Orders</span>
              <MdPayments className="text-amber-600 text-[18px]" />
            </div>
            <div>
              <h4 className="text-2xl font-black text-slate-900">{loading ? "..." : stats.codOrdersCount}</h4>
              <p className="text-[11px] font-semibold text-amber-600 mt-1">₹{loading ? "..." : stats.codRevenue.toLocaleString()} Share</p>
            </div>
          </div>

          {/* Failed Payments Card */}
          <div className="bg-rose-50/40 rounded-xl p-4 border border-rose-100 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Failed Payments</span>
              <MdError className="text-rose-600 text-[18px]" />
            </div>
            <div>
              <h4 className="text-2xl font-black text-slate-900">{loading ? "..." : stats.failedPaymentsCount}</h4>
              <p className="text-[11px] font-semibold text-rose-600 mt-1">
                {stats.onlinePaymentsCount + stats.failedPaymentsCount > 0 
                  ? `${Math.round((stats.failedPaymentsCount / (stats.onlinePaymentsCount + stats.failedPaymentsCount)) * 100)}% Failure Rate`
                  : "0% Failure Rate"
                }
              </p>
            </div>
          </div>

          {/* Total Revenue aggregation */}
          <div className="bg-emerald-50/40 rounded-xl p-4 border border-emerald-100 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Net Settlements</span>
              <MdTrendingUp className="text-emerald-600 text-[18px]" />
            </div>
            <div>
              <h4 className="text-2xl font-black text-slate-900">₹{loading ? "..." : stats.totalRevenue.toLocaleString()}</h4>
              <p className="text-[11px] font-semibold text-emerald-600 mt-1">100% verified funds</p>
            </div>
          </div>
        </div>

        {/* Online vs COD Ratio Meter */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[12px] font-bold text-slate-700">Volume Ratio Breakdown</span>
            <div className="flex gap-4 text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-500"></span>Online ({loading ? "..." : stats.onlinePaymentsCount})</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500"></span>COD ({loading ? "..." : stats.codOrdersCount})</span>
            </div>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
            {stats.onlinePaymentsCount + stats.codOrdersCount > 0 ? (
              <>
                <div 
                  className="bg-blue-500 h-full transition-all duration-500" 
                  style={{ width: `${(stats.onlinePaymentsCount / (stats.onlinePaymentsCount + stats.codOrdersCount)) * 100}%` }}
                />
                <div 
                  className="bg-amber-500 h-full transition-all duration-500" 
                  style={{ width: `${(stats.codOrdersCount / (stats.onlinePaymentsCount + stats.codOrdersCount)) * 100}%` }}
                />
              </>
            ) : (
              <div className="bg-slate-200 w-full h-full" />
            )}
          </div>
        </div>
      </div>

      {/* Main Widgets Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Live Order Stream (Spans 2 columns) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-[16px] text-slate-900">Live Order Stream</h3>
            <Link href="/admin/orders" className="text-[#FF5C00] hover:text-[#e05200] text-[13px] font-medium transition-colors">
              View All Orders
            </Link>
          </div>
          <div className="p-0 overflow-y-auto overflow-x-auto max-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white z-10 shadow-sm">
                <tr className="bg-slate-50/50">
                  <th className="py-3 px-6 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">Order ID</th>
                  <th className="py-3 px-6 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">Restaurant</th>
                  <th className="py-3 px-6 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">Status</th>
                  <th className="py-3 px-6 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 text-[13px]">Loading live orders...</td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 text-[13px]">No orders found in the database.</td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order._id} className="hover:bg-orange-50/10 transition-colors">
                      <td className="py-4 px-6 text-[13px] font-semibold text-slate-900">
                        #ORD-{order._id.substring(order._id.length - 6).toUpperCase()}
                      </td>
                      <td className="py-4 px-6 text-[13px] text-slate-600">
                        {order.restaurant?.name || (order.orderType === 'grocery' ? "ZipGrocery Delivery" : "Unknown Partner")}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${getStatusColor(order.orderStatus || order.status)}`}>
                          {formatStatus(order.orderStatus || order.status || 'placed')}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-[13px] text-slate-500 font-semibold">
                        ₹{order.totalAmount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side Column (Spans 1 column) */}
        <div className="lg:col-span-1 flex flex-col gap-6">

          {/* Live Delivery Map */}
          <div className="bg-slate-100 rounded-xl border border-slate-200 shadow-sm h-64 relative overflow-hidden flex flex-col p-6">
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: "radial-gradient(#94a3b8 1px, transparent 1px)", backgroundSize: "20px 20px" }}></div>

            {/* Map Points (Simulated) */}
            <div className="absolute top-[30%] left-[35%] w-3.5 h-3.5 bg-[#FF5C00] rounded-full shadow-[0_0_0_4px_rgba(255,92,0,0.2)]"></div>
            <div className="absolute top-[50%] left-[65%] w-3.5 h-3.5 bg-[#FF5C00] rounded-full shadow-[0_0_0_4px_rgba(255,92,0,0.2)]"></div>
            <div className="absolute bottom-[35%] right-[25%] w-3.5 h-3.5 bg-[#FF5C00] rounded-full shadow-[0_0_0_4px_rgba(255,92,0,0.2)]"></div>

            <h3 className="font-bold text-[15px] text-slate-900 relative z-10">Live Delivery Map</h3>
            <p className="text-[13px] text-slate-500 relative z-10 mb-4">{stats.totalDeliveries} active couriers</p>

            <div className="mt-auto relative z-10">
              <Link href="/admin/delivery" className="w-full py-2.5 bg-white rounded-lg text-[13px] font-semibold text-[#FF5C00] shadow-sm border border-slate-200 hover:border-[#FF5C00] transition-colors text-center block">
                View Full Map
              </Link>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
