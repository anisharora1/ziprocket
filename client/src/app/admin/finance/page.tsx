"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/services/api";

interface BankDetails {
  accountNumber: string;
  ifscCode: string;
}

interface Restaurant {
  _id: string;
  name: string;
  phone: string;
  commission: number;
}

interface UserOwner {
  _id: string;
  name: string;
  phone: string;
}

interface Payout {
  _id: string;
  recipientType: "restaurant" | "delivery" | "grocery";
  restaurant?: Restaurant;
  deliveryBoy?: UserOwner;
  weekStartDate: string;
  weekEndDate: string;
  weekIdentifier: string;
  
  totalOrders: number;
  totalRevenue: number;
  platformCommission: number;
  codCollected: number;
  onlinePayments: number;
  finalPayoutAmount: number;
  
  status: "pending" | "processing" | "paid" | "failed";
  paymentDetails?: {
    transactionId?: string;
    paidAt?: string;
    notes?: string;
  };
  createdAt: string;
}

interface GroceryAnalytics {
  totalSales: number;
  profit: number;
  itemsCount: number;
  categories: {
    categoryName: string;
    revenue: number;
    unitsSold: number;
  }[];
}

// Generate recent calendar week options for tier-3 logistics cycle (Mon -> Sun)
const WEEK_OPTIONS = [
  { id: "2026-W22", name: "May 25 - May 31, 2026 (Current Week)", date: "2026-05-27" },
  { id: "2026-W21", name: "May 18 - May 24, 2026 (Previous Week)", date: "2026-05-20" },
  { id: "2026-W20", name: "May 11 - May 17, 2026", date: "2026-05-13" },
  { id: "2026-W19", name: "May 04 - May 10, 2026", date: "2026-05-06" },
  { id: "2026-W18", name: "Apr 27 - May 03, 2026", date: "2026-04-29" },
];

export default function FinanceAdminPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    platformCommission: 0,
    pendingSettlement: 0,
    codCashToCollect: 0
  });
  const [groceryAnalytics, setGroceryAnalytics] = useState<GroceryAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedWeek, setSelectedWeek] = useState(WEEK_OPTIONS[0].id); // Defaults to current week
  const [activeTab, setActiveTab] = useState<"restaurant" | "delivery" | "grocery">("restaurant");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Inline Payout Modal States
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [settleStatus, setSettleStatus] = useState<"paid" | "failed" | "processing">("paid");
  const [transactionId, setTransactionId] = useState("");
  const [settleNotes, setSettleNotes] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);

  const fetchPayoutsAndAnalytics = async () => {
    try {
      setLoading(true);
      // Fetch payout roster & stats
      let url = `/admin/payouts?week=${selectedWeek}`;
      if (statusFilter !== "all") {
        url += `&status=${statusFilter}`;
      }
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }

      const res = await apiClient.get(url);
      if (res.data.success) {
        setPayouts(res.data.payouts || []);
        setStats(res.data.stats || { totalRevenue: 0, platformCommission: 0, pendingSettlement: 0, codCashToCollect: 0 });
      }

      // Fetch grocery analytics
      const groceryRes = await apiClient.get(`/admin/payouts/grocery-analytics?week=${selectedWeek}`);
      if (groceryRes.data.success) {
        setGroceryAnalytics(groceryRes.data.analytics || null);
      }

    } catch (err) {
      console.error("Failed to load payout details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayoutsAndAnalytics();
  }, [selectedWeek, statusFilter, searchQuery]);

  // Recalculate settlement parameters
  const handleCalculateSettlements = async () => {
    const selectedOpt = WEEK_OPTIONS.find(w => w.id === selectedWeek);
    if (!selectedOpt) return;

    if (!confirm(`Are you sure you want to calculate/re-sync settlements for cycle ${selectedWeek}?`)) {
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.post("/admin/payouts/calculate", {
        date: selectedOpt.date
      });
      if (res.data.success) {
        alert(res.data.message);
        fetchPayoutsAndAnalytics();
      }
    } catch (err: any) {
      console.error("Calculation failed:", err);
      alert("Failed to calculate weekly payouts: " + (err.response?.data?.message || err.message));
      setLoading(false);
    }
  };

  // Settle Modal Trigger
  const openSettleModal = (payout: Payout) => {
    setSelectedPayout(payout);
    setSettleStatus("paid");
    setTransactionId("");
    setSettleNotes("");
  };

  // Submit settlement status change
  const handleSaveSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayout) return;

    try {
      setSavingPayout(true);
      const res = await apiClient.patch(`/admin/payouts/${selectedPayout._id}/status`, {
        status: settleStatus,
        transactionId,
        notes: settleNotes
      });
      if (res.data.success) {
        alert("Settlement updated successfully!");
        setSelectedPayout(null);
        fetchPayoutsAndAnalytics();
      }
    } catch (err) {
      console.error("Failed to save payout:", err);
      alert("Failed to save payout.");
    } finally {
      setSavingPayout(false);
    }
  };

  // Client-Side CSV report exporting
  const handleExportCSV = () => {
    if (payouts.length === 0) {
      alert("No payout data available to export.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Payout ID,Recipient Type,Recipient Name,Phone,Week Cycle,Orders,Total Revenue,Commission,COD Collected,Final Payout,Status,Transaction ID,Settlement Date\n";

    payouts.forEach(p => {
      const name = p.recipientType === "restaurant" ? p.restaurant?.name : p.deliveryBoy?.name || "Grocery Platform";
      const phone = p.recipientType === "restaurant" ? p.restaurant?.phone : p.deliveryBoy?.phone || "N/A";
      const transId = p.paymentDetails?.transactionId || "N/A";
      const paidDate = p.paymentDetails?.paidAt ? new Date(p.paymentDetails.paidAt).toLocaleDateString() : "N/A";

      const row = `"${p._id}","${p.recipientType}","${name}","${phone}","${p.weekIdentifier}",${p.totalOrders},${p.totalRevenue},${p.platformCommission},${p.codCollected},${p.finalPayoutAmount},"${p.status}","${transId}","${paidDate}"`;
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ZipRocket_Payout_Report_${selectedWeek}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter rosters by active tab
  const filteredPayouts = payouts.filter(p => p.recipientType === activeTab);

  // Dynamic calculations for grocery profits
  const platformProfitTotal = stats.platformCommission + (groceryAnalytics?.profit || 0);

  return (
    <div className="flex-1 p-6 md:p-8 bg-slate-50/30 flex flex-col min-w-0 overflow-y-auto">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="max-w-2xl">
          <h2 className="text-[28px] font-black text-slate-800 tracking-tight leading-none mb-3">Settlements & Weekly Payouts</h2>
          <p className="text-[13px] font-semibold text-slate-400 uppercase tracking-widest leading-none mt-2">
            Audit weekly platform profits, reconcile courier COD cash, and process restaurant settlements
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="px-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-[12px] font-bold text-slate-700 focus:outline-none focus:border-slate-850 shadow-sm transition-colors cursor-pointer"
          >
            {WEEK_OPTIONS.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>

          <button 
            onClick={handleCalculateSettlements}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-[12px] font-bold transition-all active:scale-95 flex items-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">calculate</span>
            Calculate Settlements
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Gross Sales */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3">Weekly Gross Sales</p>
          <div className="flex items-center justify-between">
            <h3 className="text-3xl font-black text-slate-800 leading-none">₹{stats.totalRevenue.toLocaleString()}</h3>
            <span className="w-9 h-9 bg-primary-container/10 text-primary-container rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">payments</span>
            </span>
          </div>
        </div>

        {/* Platform Profit */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3 pl-1">Weekly Platform Profit</p>
          <div className="flex items-center justify-between pl-1">
            <h3 className="text-3xl font-black text-slate-800 leading-none">₹{platformProfitTotal.toLocaleString()}</h3>
            <span className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">trending_up</span>
            </span>
          </div>
        </div>

        {/* Pending Settlements */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3 pl-1">Pending Settlements</p>
          <div className="flex items-center justify-between pl-1">
            <h3 className="text-3xl font-black text-slate-800 leading-none">₹{stats.pendingSettlement.toLocaleString()}</h3>
            <span className="w-9 h-9 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">hourglass_empty</span>
            </span>
          </div>
        </div>

        {/* COD Cash to Collect */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500"></div>
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3 pl-1">COD Cash to Collect</p>
          <div className="flex items-center justify-between pl-1">
            <h3 className={`text-3xl font-black leading-none ${stats.codCashToCollect > 2000 ? "text-rose-600" : "text-slate-800"}`}>
              ₹{stats.codCashToCollect.toLocaleString()}
            </h3>
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              stats.codCashToCollect > 2000 ? "bg-rose-100 text-rose-600 animate-bounce" : "bg-rose-50 text-rose-500"
            }`}>
              <span className="material-symbols-outlined text-[20px]">price_check</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Operations Card */}
      <div className="bg-white min-h-[450px] rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden mb-8">
        
        {/* Navigation Tabs Bar */}
        <div className="flex border-b border-slate-100 bg-slate-50/20">
          <button
            onClick={() => setActiveTab("restaurant")}
            className={`flex-1 py-4 text-center text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
              activeTab === "restaurant" 
                ? "border-[#FF5C00] text-[#FF5C00] bg-white" 
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Restaurant Settlements
          </button>
          <button
            onClick={() => setActiveTab("delivery")}
            className={`flex-1 py-4 text-center text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
              activeTab === "delivery" 
                ? "border-[#FF5C00] text-[#FF5C00] bg-white" 
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Delivery Boy Payouts
          </button>
          <button
            onClick={() => setActiveTab("grocery")}
            className={`flex-1 py-4 text-center text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
              activeTab === "grocery" 
                ? "border-[#FF5C00] text-[#FF5C00] bg-white" 
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Grocery Revenue
          </button>
        </div>

        {/* Toolbar */}
        {activeTab !== "grocery" && (
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/10">
            <div className="relative w-full md:w-96">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-[13px] font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-850 shadow-sm transition-colors"
              />
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status Filter:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-white border-2 border-slate-200 rounded-2xl text-[12px] font-bold text-slate-700 focus:outline-none focus:border-slate-850 shadow-sm transition-colors cursor-pointer"
              >
                <option value="all">All Settlements</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
              </select>

              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl text-[12px] font-bold hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">download_for_offline</span>
                Export CSV Report
              </button>
            </div>
          </div>
        )}

        {/* Content Rosters */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 text-center text-slate-400 font-semibold text-xs">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-3"></div>
              Calculating payout records...
            </div>
          ) : activeTab === "grocery" ? (
            /* --- GROCERY REVENUE TAB VIEW --- */
            <div className="p-6 space-y-8 animate-in fade-in duration-200">
              {groceryAnalytics ? (
                <>
                  {/* Grocery summary metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 shadow-inner">
                      <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">Total Grocery Sales</p>
                      <h4 className="text-2xl font-black text-slate-800">₹{groceryAnalytics.totalSales.toLocaleString()}</h4>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 shadow-inner">
                      <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">Items / Units Sold</p>
                      <h4 className="text-2xl font-black text-slate-800">{groceryAnalytics.itemsCount} units</h4>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 shadow-inner">
                      <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">Platform Profit (20%)</p>
                      <h4 className="text-2xl font-black text-[#FF5C00]">₹{groceryAnalytics.profit.toLocaleString()}</h4>
                    </div>
                  </div>

                  {/* Category-wise breakdown list */}
                  <div className="space-y-4 pt-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Category-wise Sales Metrics</h4>
                    {groceryAnalytics.categories.length === 0 ? (
                      <p className="text-xs text-slate-400 font-bold py-6">No category-wise sales logged for this week.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {groceryAnalytics.categories.map((cat, idx) => (
                          <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                            <div>
                              <span className="inline-block px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black uppercase text-slate-600 mb-1.5">
                                {cat.categoryName}
                              </span>
                              <p className="text-xs font-semibold text-slate-400">{cat.unitsSold} units sold</p>
                            </div>
                            <h5 className="text-base font-black text-slate-800">₹{cat.revenue.toLocaleString()}</h5>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-20 text-center text-slate-400 font-bold text-xs">
                  No grocery revenue metrics available for week {selectedWeek}.
                </div>
              )}
            </div>
          ) : filteredPayouts.length === 0 ? (
            <div className="py-20 text-center text-slate-400 font-bold text-xs">
              <span className="material-symbols-outlined text-[40px] text-slate-200 block mb-2">account_balance_wallet</span>
              No weekly payout logs found for this cycle.
            </div>
          ) : (
            /* --- RESTAURANT & DELIVERY TABLE VIEW --- */
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/20 border-b border-slate-100">
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Partner/Rider Details</th>
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Delivered Orders</th>
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Gross Revenue</th>
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    {activeTab === "restaurant" ? "Platform Commission" : "COD Cash Held"}
                  </th>
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Net Payables</th>
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Payout Status</th>
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Settlement Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayouts.map((p) => {
                  const name = p.recipientType === "restaurant" ? p.restaurant?.name : p.deliveryBoy?.name;
                  const phone = p.recipientType === "restaurant" ? p.restaurant?.phone : p.deliveryBoy?.phone;
                  
                  return (
                    <tr key={p._id} className="hover:bg-slate-50/30 transition-colors">
                      {/* Name Details */}
                      <td className="py-4 px-6">
                        <h4 className="text-[14px] font-black text-slate-800 leading-snug">{name || "Unnamed Recipient"}</h4>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                          Tel: +91 {phone}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
                          ID: #{p._id.substring(p._id.length - 4).toUpperCase()}
                        </p>
                      </td>

                      {/* Orders Count */}
                      <td className="py-4 px-6 text-center font-bold text-slate-700 text-sm">
                        {p.totalOrders}
                      </td>

                      {/* Gross Revenue */}
                      <td className="py-4 px-6 font-bold text-slate-700">
                        ₹{p.totalRevenue.toLocaleString()}
                      </td>

                      {/* Commission/COD */}
                      <td className="py-4 px-6 font-bold">
                        {activeTab === "restaurant" ? (
                          <span className="text-slate-650">₹{p.platformCommission.toLocaleString()}</span>
                        ) : (
                          <span className={`${p.codCollected > 2000 ? "text-rose-600" : "text-slate-650"}`}>
                            ₹{p.codCollected.toLocaleString()}
                          </span>
                        )}
                      </td>

                      {/* Net Payables */}
                      <td className="py-4 px-6 font-black text-slate-850">
                        ₹{p.finalPayoutAmount.toLocaleString()}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase ${
                          p.status === "paid"
                            ? "bg-emerald-50 text-emerald-700"
                            : p.status === "processing"
                            ? "bg-blue-50 text-blue-700"
                            : p.status === "failed"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-amber-50 text-amber-700"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            p.status === "paid"
                              ? "bg-emerald-500"
                              : p.status === "processing"
                              ? "bg-blue-500"
                              : p.status === "failed"
                              ? "bg-rose-500"
                              : "bg-amber-500"
                          }`}></span>
                          {p.status}
                        </span>
                        {p.paymentDetails?.transactionId && (
                          <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">
                            TXN: {p.paymentDetails.transactionId}
                          </p>
                        )}
                      </td>

                      {/* Settle Action */}
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => openSettleModal(p)}
                          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors inline-flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">account_balance</span>
                          Update Payout
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Settle Modal Drawer */}
      {selectedPayout && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div 
            className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col"
            style={{ width: "450px", maxWidth: "95%", minHeight: "380px" }}
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
              <div>
                <h3 className="font-black text-base text-slate-800">Process Weekly Settlement</h3>
                <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                  Recipient ID: #{selectedPayout._id.substring(selectedPayout._id.length - 8).toUpperCase()}
                </p>
              </div>
              <button 
                onClick={() => setSelectedPayout(null)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveSettlement} className="p-6 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Settlement Status</label>
                  <select 
                    value={settleStatus}
                    onChange={(e) => setSettleStatus(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-[13px] font-bold text-slate-700 focus:outline-none focus:border-slate-800 shadow-sm cursor-pointer"
                  >
                    <option value="paid">Paid (Mark Completed)</option>
                    <option value="processing">Processing (On Hold)</option>
                    <option value="failed">Failed (Error / Cancelled)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Transaction ID / Bank Reference</label>
                  <input 
                    type="text" 
                    placeholder="e.g. TXN90281234912" 
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-[13px] font-bold text-slate-800 focus:outline-none focus:border-slate-800 transition-colors shadow-sm" 
                    required={settleStatus === "paid"}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Internal Settlement Notes</label>
                  <textarea 
                    placeholder="Describe bank settlements, transfers, or cash reconciliations..." 
                    value={settleNotes}
                    onChange={(e) => setSettleNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-[13px] font-bold text-slate-800 focus:outline-none focus:border-slate-800 transition-colors shadow-sm" 
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3 mt-auto">
                <button 
                  type="button" 
                  onClick={() => setSelectedPayout(null)}
                  className="flex-1 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl text-[13px] font-bold hover:bg-slate-50 transition-colors active:scale-95"
                >
                  Close
                </button>
                <button 
                  type="submit" 
                  disabled={savingPayout}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-[13px] font-black uppercase tracking-wider transition-colors disabled:opacity-50 active:scale-95"
                >
                  {savingPayout ? "Saving..." : "Commit Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
