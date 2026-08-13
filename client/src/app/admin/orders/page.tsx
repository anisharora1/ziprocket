"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/services/api";
import { MdSearch, MdRefresh, MdChevronRight } from "react-icons/md";

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

export default function OrdersAdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchOrders = async () => {
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
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchOrders();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-700';
      case 'preparing': return 'bg-orange-50 text-orange-700';
      case 'ready': return 'bg-blue-50 text-blue-700';
      case 'out_for_delivery': return 'bg-indigo-50 text-indigo-700';
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
            historical orders.
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
              <tr className="border-b border-slate-100">
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
                  <tr key={order._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-5 px-6">
                      <span className="text-[14px] font-bold text-slate-900">
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
                      <MdChevronRight className="text-slate-300 text-[20px] group-hover:text-slate-500 transition-colors inline-block" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
