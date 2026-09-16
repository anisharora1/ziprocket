"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/services/api";
import {
  MdRefresh,
  MdAltRoute,
  MdDirectionsBike,
  MdPayments,
  MdAccountBalanceWallet,
  MdSearch,
  MdCheckCircle,
  MdCancel,
  MdHourglassEmpty,
  MdCalendarToday,
  MdReceiptLong,
  MdQrCodeScanner,
  MdPaid,
  MdSpeed,
  MdFilterList,
  MdDone,
  MdClose
} from "react-icons/md";

interface OpsSummaryRider {
  deliveryBoy: {
    _id: string;
    name: string;
    phone: string;
  };
  ordersCompleted: number;
  totalDistanceKm: number;
  cashCollectedToday: number;
  cashHeld: number;
}

interface PendingSettlement {
  _id: string;
  deliveryBoy: {
    _id: string;
    name: string;
    phone: string;
  };
  type: "cash_handover" | "digital_payment";
  amount: number;
  transactionId?: string;
  paymentDate?: string;
  notes?: string;
  status: "pending" | "confirmed" | "rejected";
  createdAt: string;
}

interface MonthlyDistanceItem {
  _id: string;
  rider: {
    _id: string;
    name: string;
    phone: string;
  };
  totalDistanceKm: number;
  totalOrders: number;
}

export default function DeliveryOpsAdminPage() {
  const [activeTab, setActiveTab] = useState<"ops" | "settlements" | "distance">("ops");

  // Ops Summary State
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [opsSummary, setOpsSummary] = useState<OpsSummaryRider[]>([]);
  const [loadingOps, setLoadingOps] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Pending Settlements State
  const [pendingSettlements, setPendingSettlements] = useState<PendingSettlement[]>([]);
  const [loadingPending, setLoadingPending] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Monthly Distance State
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [distanceReport, setDistanceReport] = useState<MonthlyDistanceItem[]>([]);
  const [loadingDistance, setLoadingDistance] = useState<boolean>(false);

  // Fetch Delivery Ops Summary
  const fetchOpsSummary = async (start = startDate, end = endDate) => {
    try {
      setLoadingOps(true);
      const res = await apiClient.get(`/delivery-ops/ops-summary?startDate=${start}&endDate=${end}`);
      if (res.data.success) {
        setOpsSummary(res.data.summary || []);
      }
    } catch (err) {
      console.error("Failed to fetch ops summary:", err);
    } finally {
      setLoadingOps(false);
    }
  };

  // Fetch Pending Settlements
  const fetchPendingSettlements = async () => {
    try {
      setLoadingPending(true);
      const res = await apiClient.get("/delivery-ops/settlements/pending");
      if (res.data.success) {
        setPendingSettlements(res.data.settlements || []);
      }
    } catch (err) {
      console.error("Failed to fetch pending settlements:", err);
    } finally {
      setLoadingPending(false);
    }
  };

  // Fetch Monthly Distance Report
  const fetchDistanceReport = async (month = selectedMonth, year = selectedYear) => {
    try {
      setLoadingDistance(true);
      const res = await apiClient.get(`/delivery-ops/distance-report?month=${month}&year=${year}`);
      if (res.data.success) {
        setDistanceReport(res.data.report || []);
      }
    } catch (err) {
      console.error("Failed to fetch distance report:", err);
    } finally {
      setLoadingDistance(false);
    }
  };

  useEffect(() => {
    fetchOpsSummary(startDate, endDate);
    fetchPendingSettlements();
  }, []);

  useEffect(() => {
    if (activeTab === "distance") {
      fetchDistanceReport(selectedMonth, selectedYear);
    }
  }, [activeTab, selectedMonth, selectedYear]);

  const handleReviewSettlement = async (id: string, action: "confirm" | "reject") => {
    try {
      setActionLoadingId(id);
      setFeedbackMessage(null);
      const res = await apiClient.patch(`/delivery-ops/settlements/${id}/review`, { action });
      if (res.data.success) {
        setFeedbackMessage({
          type: "success",
          text: `Settlement successfully ${action === "confirm" ? "confirmed" : "rejected"}!`
        });
        // Refresh settlements & ops summary (as confirmed handovers reduce cashHeld)
        await Promise.all([fetchPendingSettlements(), fetchOpsSummary(startDate, endDate)]);
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err.response?.data?.message || `Failed to ${action} settlement.`
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleQuickPreset = (preset: "today" | "yesterday" | "7days" | "month") => {
    const today = new Date();
    let s = new Date();
    let e = new Date();

    if (preset === "today") {
      // today
    } else if (preset === "yesterday") {
      s.setDate(today.getDate() - 1);
      e.setDate(today.getDate() - 1);
    } else if (preset === "7days") {
      s.setDate(today.getDate() - 6);
    } else if (preset === "month") {
      s = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    const startStr = s.toISOString().split("T")[0];
    const endStr = e.toISOString().split("T")[0];
    setStartDate(startStr);
    setEndDate(endStr);
    fetchOpsSummary(startStr, endStr);
  };

  // Filtered Summary
  const filteredOps = opsSummary.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.deliveryBoy?.name?.toLowerCase().includes(q) ||
      item.deliveryBoy?.phone?.includes(q)
    );
  });

  // Calculate Totals for Stat Cards
  const totalOrdersCount = opsSummary.reduce((sum, item) => sum + (item.ordersCompleted || 0), 0);
  const totalKmTraveled = Math.round(opsSummary.reduce((sum, item) => sum + (item.totalDistanceKm || 0), 0) * 10) / 10;
  const totalPeriodCash = opsSummary.reduce((sum, item) => sum + (item.cashCollectedToday || 0), 0);
  const totalOutstandingCashHeld = opsSummary.reduce((sum, item) => sum + (item.cashHeld || 0), 0);

  const monthsList = [
    { num: 1, name: "January" },
    { num: 2, name: "February" },
    { num: 3, name: "March" },
    { num: 4, name: "April" },
    { num: 5, name: "May" },
    { num: 6, name: "June" },
    { num: 7, name: "July" },
    { num: 8, name: "August" },
    { num: 9, name: "September" },
    { num: 10, name: "October" },
    { num: 11, name: "November" },
    { num: 12, name: "December" }
  ];

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-primary flex items-center justify-center">
              <MdAltRoute className="text-[22px]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Delivery Operations</h1>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Real-time courier logs, cash collections, handovers, and distance telemetry
              </p>
            </div>
          </div>
        </div>

        {/* Global Refresh Button */}
        <button
          onClick={() => {
            fetchOpsSummary(startDate, endDate);
            fetchPendingSettlements();
            if (activeTab === "distance") fetchDistanceReport(selectedMonth, selectedYear);
          }}
          disabled={loadingOps || loadingPending || loadingDistance}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-xs active:scale-95 disabled:opacity-50"
        >
          <MdRefresh className={`text-base ${(loadingOps || loadingPending || loadingDistance) ? "animate-spin" : ""}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between animate-in fade-in duration-200 ${
            feedbackMessage.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === "success" ? (
              <MdCheckCircle className="text-base text-emerald-600 shrink-0" />
            ) : (
              <MdCancel className="text-base text-rose-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-slate-400 hover:text-slate-600">
            <MdClose className="text-base" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab("ops")}
          className={`px-4 py-3 rounded-t-2xl font-black text-xs transition-all flex items-center gap-2 whitespace-nowrap border-b-2 ${
            activeTab === "ops"
              ? "border-primary text-primary bg-orange-50/50"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <MdDirectionsBike className="text-base" />
          <span>Daily Ops & Cash Held</span>
        </button>

        <button
          onClick={() => setActiveTab("settlements")}
          className={`px-4 py-3 rounded-t-2xl font-black text-xs transition-all flex items-center gap-2 whitespace-nowrap border-b-2 ${
            activeTab === "settlements"
              ? "border-primary text-primary bg-orange-50/50"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <MdReceiptLong className="text-base" />
          <span>Pending Settlements</span>
          {pendingSettlements.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
              {pendingSettlements.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("distance")}
          className={`px-4 py-3 rounded-t-2xl font-black text-xs transition-all flex items-center gap-2 whitespace-nowrap border-b-2 ${
            activeTab === "distance"
              ? "border-primary text-primary bg-orange-50/50"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <MdSpeed className="text-base" />
          <span>Monthly Distance Reports</span>
        </button>
      </div>

      {/* ─── TAB 1: DAILY OPS & CASH HELD ─── */}
      {activeTab === "ops" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Stat Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-black uppercase tracking-wider">
                <span>Orders Completed</span>
                <MdDirectionsBike className="text-lg text-primary" />
              </div>
              <p className="text-2xl font-black text-slate-900">{totalOrdersCount}</p>
              <p className="text-[11px] font-semibold text-slate-400">Selected period total</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-black uppercase tracking-wider">
                <span>Distance Traveled</span>
                <MdSpeed className="text-lg text-blue-500" />
              </div>
              <p className="text-2xl font-black text-slate-900">{totalKmTraveled} <span className="text-sm font-bold text-slate-400">KM</span></p>
              <p className="text-[11px] font-semibold text-slate-400">Telemetry route sum</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-black uppercase tracking-wider">
                <span>Cash Collected</span>
                <MdPaid className="text-lg text-emerald-500" />
              </div>
              <p className="text-2xl font-black text-emerald-600">₹{totalPeriodCash.toLocaleString()}</p>
              <p className="text-[11px] font-semibold text-slate-400">COD receipts in period</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-black uppercase tracking-wider">
                <span>Total Cash Held</span>
                <MdAccountBalanceWallet className="text-lg text-amber-500" />
              </div>
              <p className="text-2xl font-black text-amber-600">₹{totalOutstandingCashHeld.toLocaleString()}</p>
              <p className="text-[11px] font-semibold text-slate-400">Unremitted fleet balance</p>
            </div>
          </div>

          {/* Date Range Selector & Search Controls */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider mr-1">Date Range:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  fetchOpsSummary(e.target.value, endDate);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-slate-400 font-bold text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  fetchOpsSummary(startDate, e.target.value);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />

              {/* Quick Presets */}
              <div className="flex items-center gap-1 ml-2">
                <button
                  type="button"
                  onClick={() => handleQuickPreset("today")}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] rounded-lg transition-colors"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset("yesterday")}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] rounded-lg transition-colors"
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset("7days")}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] rounded-lg transition-colors"
                >
                  7 Days
                </button>
              </div>
            </div>

            {/* Courier Search */}
            <div className="relative min-w-[240px]">
              <MdSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base" />
              <input
                type="text"
                placeholder="Search rider by name/phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Courier Ops Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Fleet Daily Ops & Balance Sheet
              </h2>
              <span className="text-xs font-bold text-slate-400">{filteredOps.length} Couriers Active</span>
            </div>

            {loadingOps ? (
              <div className="p-12 text-center text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
                <MdRefresh className="animate-spin text-lg" /> Loading ops telemetry...
              </div>
            ) : filteredOps.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs font-bold">
                No delivery partners found matching the filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-100">
                      <th className="p-4 pl-6">Courier Name</th>
                      <th className="p-4">Contact Phone</th>
                      <th className="p-4 text-center">Orders Completed</th>
                      <th className="p-4 text-center">Distance Traveled</th>
                      <th className="p-4 text-right">Cash Collected (Period)</th>
                      <th className="p-4 text-right pr-6">Cash Held (Running Total)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                    {filteredOps.map((rider) => {
                      const hasCashHeld = rider.cashHeld > 0;
                      return (
                        <tr key={rider.deliveryBoy._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-4 pl-6 font-bold text-slate-900 flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center">
                              {rider.deliveryBoy.name?.charAt(0)?.toUpperCase() || "R"}
                            </div>
                            <span>{rider.deliveryBoy.name}</span>
                          </td>
                          <td className="p-4 font-mono text-slate-500">{rider.deliveryBoy.phone}</td>
                          <td className="p-4 text-center">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-black text-slate-800">
                              {rider.ordersCompleted}
                            </span>
                          </td>
                          <td className="p-4 text-center font-bold text-slate-800">
                            {rider.totalDistanceKm} <span className="text-[10px] text-slate-400">KM</span>
                          </td>
                          <td className="p-4 text-right font-black text-emerald-600">
                            ₹{rider.cashCollectedToday.toLocaleString()}
                          </td>
                          <td className="p-4 text-right pr-6">
                            <span
                              className={`inline-block px-3 py-1 rounded-xl font-black ${
                                hasCashHeld
                                  ? "bg-amber-50 border border-amber-200 text-amber-800"
                                  : "bg-slate-50 border border-slate-200 text-slate-500"
                              }`}
                            >
                              ₹{rider.cashHeld.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: PENDING SETTLEMENTS QUEUE ─── */}
      {activeTab === "settlements" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Pending Cash Handovers & Remittances
                </h2>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                  Confirm physical cash handovers or verify digital UTR payment receipts
                </p>
              </div>
              <span className="text-xs font-black px-3 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
                {pendingSettlements.length} Awaiting Confirmation
              </span>
            </div>

            {loadingPending ? (
              <div className="p-12 text-center text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
                <MdRefresh className="animate-spin text-lg" /> Loading pending handovers...
              </div>
            ) : pendingSettlements.length === 0 ? (
              <div className="p-16 text-center space-y-2">
                <MdCheckCircle className="text-4xl text-emerald-400 mx-auto" />
                <h3 className="text-sm font-black text-slate-800">All Clear! No Pending Handovers</h3>
                <p className="text-xs text-slate-400">All courier-initiated settlements have been reviewed.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-100">
                      <th className="p-4 pl-6">Courier</th>
                      <th className="p-4">Type</th>
                      <th className="p-4 text-right">Amount</th>
                      <th className="p-4">Details / UTR</th>
                      <th className="p-4">Submitted At</th>
                      <th className="p-4 text-right pr-6">Review Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                    {pendingSettlements.map((s) => (
                      <tr key={s._id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-4 pl-6 font-bold text-slate-900">
                          <div>{s.deliveryBoy?.name}</div>
                          <div className="text-[11px] font-mono text-slate-400 font-normal">{s.deliveryBoy?.phone}</div>
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider ${
                              s.type === "cash_handover"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-blue-50 text-blue-800 border border-blue-200"
                            }`}
                          >
                            {s.type === "cash_handover" ? <MdPaid /> : <MdQrCodeScanner />}
                            {s.type === "cash_handover" ? "Cash" : "Digital"}
                          </span>
                        </td>

                        <td className="p-4 text-right font-black text-sm text-slate-900">
                          ₹{s.amount.toLocaleString()}
                        </td>

                        <td className="p-4 space-y-0.5">
                          {s.transactionId && (
                            <div className="font-mono text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded inline-block font-bold">
                              UTR: {s.transactionId}
                            </div>
                          )}
                          {s.paymentDate && (
                            <div className="text-[11px] text-slate-400">
                              Date: {new Date(s.paymentDate).toLocaleDateString()}
                            </div>
                          )}
                          {s.notes && (
                            <div className="text-[11px] text-slate-500 italic max-w-xs truncate">{s.notes}</div>
                          )}
                        </td>

                        <td className="p-4 text-slate-500 text-[11px]">
                          {new Date(s.createdAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </td>

                        <td className="p-4 text-right pr-6">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleReviewSettlement(s._id, "confirm")}
                              disabled={actionLoadingId === s._id}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 active:scale-95 disabled:opacity-50"
                            >
                              <MdDone className="text-sm" />
                              <span>Confirm</span>
                            </button>

                            <button
                              onClick={() => handleReviewSettlement(s._id, "reject")}
                              disabled={actionLoadingId === s._id}
                              className="px-3 py-1.5 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 active:scale-95 disabled:opacity-50"
                            >
                              <MdClose className="text-sm" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: MONTHLY DISTANCE REPORT ─── */}
      {activeTab === "distance" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Month & Year Selectors */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Select Period:</span>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setSelectedMonth(m);
                  fetchDistanceReport(m, selectedYear);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {monthsList.map((m) => (
                  <option key={m.num} value={m.num}>
                    {m.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setSelectedYear(y);
                  fetchDistanceReport(selectedMonth, y);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs font-bold text-slate-500">
              Fleet Distance Telemetry for {monthsList.find((m) => m.num === selectedMonth)?.name} {selectedYear}
            </div>
          </div>

          {/* Distance Telemetry Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Monthly Courier Distance Rankings
              </h2>
              <span className="text-xs font-bold text-slate-400">{distanceReport.length} Couriers Logged</span>
            </div>

            {loadingDistance ? (
              <div className="p-12 text-center text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
                <MdRefresh className="animate-spin text-lg" /> Computing distance logs...
              </div>
            ) : distanceReport.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-xs font-bold">
                No delivery distance logs found for the selected month.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-100">
                      <th className="p-4 pl-6">Rank</th>
                      <th className="p-4">Courier Name</th>
                      <th className="p-4">Phone Number</th>
                      <th className="p-4 text-center">Total Orders</th>
                      <th className="p-4 text-center">Total Distance Covered</th>
                      <th className="p-4 text-right pr-6">Avg Distance / Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                    {distanceReport.map((item, idx) => {
                      const avgKm = item.totalOrders > 0 ? (item.totalDistanceKm / item.totalOrders).toFixed(1) : "0.0";
                      return (
                        <tr key={item._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-4 pl-6">
                            <span
                              className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-black text-xs ${
                                idx === 0
                                  ? "bg-amber-100 text-amber-800"
                                  : idx === 1
                                  ? "bg-slate-200 text-slate-800"
                                  : idx === 2
                                  ? "bg-orange-100 text-orange-800"
                                  : "text-slate-400"
                              }`}
                            >
                              #{idx + 1}
                            </span>
                          </td>
                          <td className="p-4 font-bold text-slate-900">{item.rider?.name}</td>
                          <td className="p-4 font-mono text-slate-500">{item.rider?.phone}</td>
                          <td className="p-4 text-center">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-black text-slate-800">
                              {item.totalOrders}
                            </span>
                          </td>
                          <td className="p-4 text-center font-black text-slate-900">
                            {item.totalDistanceKm} <span className="text-[10px] text-slate-400 font-bold">KM</span>
                          </td>
                          <td className="p-4 text-right pr-6 font-bold text-slate-600">
                            {avgKm} <span className="text-[10px] text-slate-400">KM/order</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
