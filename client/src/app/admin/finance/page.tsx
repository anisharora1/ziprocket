"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/services/api";
import { 
  MdCalculate, 
  MdPayments, 
  MdTrendingUp, 
  MdHourglassEmpty, 
  MdPriceCheck, 
  MdSearch, 
  MdDownloadForOffline, 
  MdAccountBalanceWallet, 
  MdAccountBalance, 
  MdClose,
  MdCheckCircle,
  MdHistory
} from "react-icons/md";

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
  periodStartDate: string;
  periodEndDate: string;
  periodIdentifier: string;
  
  totalOrders: number;
  totalRevenue: number;
  platformCommission: number;
  refundsAndAdjustments: number;
  adjustmentNotes?: string;
  codCollected: number;
  onlinePayments: number;
  finalPayoutAmount: number;
  isEstimatedMargin?: boolean;
  
  status: "pending" | "processing" | "paid" | "failed";
  paymentDetails?: {
    transactionId?: string;
    paidAt?: string;
    notes?: string;
  };
  auditLogs?: {
    status: string;
    updatedBy: string;
    updatedAt: string;
    notes?: string;
  }[];
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

// 3-day rolling cycle anchor helper
function getSettlementPeriod(referenceDate: Date) {
  const epoch = new Date("2026-01-01T00:00:00Z");
  const msPerCycle = 3 * 24 * 60 * 60 * 1000;
  const cyclesSinceEpoch = Math.floor((referenceDate.getTime() - epoch.getTime()) / msPerCycle);
  const periodStart = new Date(epoch.getTime() + cyclesSinceEpoch * msPerCycle);
  const periodEnd = new Date(periodStart.getTime() + msPerCycle - 1);
  const identifier = `${periodStart.toISOString().split("T")[0]}_${periodEnd.toISOString().split("T")[0]}`;
  return { periodStart, periodEnd, identifier };
}

function generatePeriodOptions(count = 12) {
  const options: { id: string; name: string; date: string; periodStart: Date; periodEnd: Date }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const targetDate = new Date(now.getTime() - i * 3 * 24 * 60 * 60 * 1000);
    const { periodStart, periodEnd, identifier } = getSettlementPeriod(targetDate);
    if (!options.some(o => o.id === identifier)) {
      const label = `${periodStart.toLocaleDateString("en-IN", { month: "short", day: "numeric" })} - ${periodEnd.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}${i === 0 ? " (Current 3-Day Cycle)" : i === 1 ? " (Previous Cycle)" : ""}`;
      options.push({ id: identifier, name: label, date: periodStart.toISOString().split("T")[0], periodStart, periodEnd });
    }
  }
  return options;
}

const PERIOD_OPTIONS = generatePeriodOptions();

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
  const [selectedPeriod, setSelectedPeriod] = useState(PERIOD_OPTIONS[0].id);
  const [activeTab, setActiveTab] = useState<"restaurant" | "delivery" | "grocery">("restaurant");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Confirmation Modal States
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [settleStatus, setSettleStatus] = useState<"paid" | "failed" | "processing">("paid");
  const [transactionId, setTransactionId] = useState("");
  const [settleNotes, setSettleNotes] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);
  const [showAuditLogs, setShowAuditLogs] = useState<Payout | null>(null);

  const fetchPayoutsAndAnalytics = async () => {
    try {
      setLoading(true);
      let url = `/admin/payouts?period=${selectedPeriod}`;
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
      const groceryRes = await apiClient.get(`/admin/payouts/grocery-analytics?period=${selectedPeriod}`);
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
  }, [selectedPeriod, statusFilter, searchQuery]);

  // Recalculate settlement parameters
  const handleCalculateSettlements = async () => {
    const selectedOpt = PERIOD_OPTIONS.find(w => w.id === selectedPeriod);
    if (!selectedOpt) return;

    if (!confirm(`Are you sure you want to calculate/re-sync settlements for 3-day cycle ${selectedPeriod}?`)) {
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
      alert("Failed to calculate settlements: " + (err.response?.data?.message || err.message));
      setLoading(false);
    }
  };

  // Open Settle / Payment Confirmation Modal
  const openSettleModal = (payout: Payout) => {
    setSelectedPayout(payout);
    setSettleStatus(payout.status === "paid" ? "paid" : "paid");
    setTransactionId(payout.paymentDetails?.transactionId || "");
    setSettleNotes(payout.paymentDetails?.notes || "");
  };

  // Submit payment confirmation or correction
  const handleSaveSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayout) return;

    if (settleStatus === "paid" && !transactionId.trim()) {
      alert("A Transaction ID / UTR number is required to mark a payout as paid.");
      return;
    }

    try {
      setSavingPayout(true);
      const res = await apiClient.patch(`/admin/payouts/${selectedPayout._id}/status`, {
        status: settleStatus,
        transactionId: transactionId.trim(),
        notes: settleNotes
      });
      if (res.data.success) {
        alert("Settlement updated successfully!");
        setSelectedPayout(null);
        fetchPayoutsAndAnalytics();
      }
    } catch (err: any) {
      console.error("Failed to save payout:", err);
      alert("Failed to save payout: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingPayout(false);
    }
  };

  const formatPeriod = (p: Payout) => {
    if (!p.periodStartDate || !p.periodEndDate) return p.periodIdentifier || "3-Day Cycle";
    const start = new Date(p.periodStartDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    const end = new Date(p.periodEndDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
    return `${start} – ${end}`;
  };

  // Export CSV report
  const handleExportCSV = () => {
    if (payouts.length === 0) {
      alert("No payout data available to export.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Payout ID,Recipient Type,Recipient Name,Phone,Period Cycle,Orders,Food Sales / Revenue,Commission,Adjustments,COD Collected,Net Payout,Status,Transaction ID / UTR,Settlement Date\n";

    payouts.forEach(p => {
      const name = p.recipientType === "restaurant" ? p.restaurant?.name : p.deliveryBoy?.name || "Grocery Platform";
      const phone = p.recipientType === "restaurant" ? p.restaurant?.phone : p.deliveryBoy?.phone || "N/A";
      const transId = p.paymentDetails?.transactionId || "N/A";
      const paidDate = p.paymentDetails?.paidAt ? new Date(p.paymentDetails.paidAt).toLocaleDateString() : "N/A";

      const row = `"${p._id}","${p.recipientType}","${name}","${phone}","${p.periodIdentifier}",${p.totalOrders},${p.totalRevenue},${p.platformCommission},${p.refundsAndAdjustments || 0},${p.codCollected},${p.finalPayoutAmount},"${p.status}","${transId}","${paidDate}"`;
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ZipRocket_Settlement_Report_${selectedPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredPayouts = payouts.filter(p => p.recipientType === activeTab);
  const platformProfitTotal = stats.platformCommission + (groceryAnalytics?.profit || 0);

  return (
    <div className="flex-1 p-6 md:p-8 bg-slate-50/30 flex flex-col min-w-0 overflow-y-auto">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="max-w-2xl">
          <h2 className="text-[28px] font-black text-slate-800 tracking-tight leading-none mb-3">3-Day Settlements &amp; Payouts</h2>
          <p className="text-[13px] font-semibold text-slate-400 uppercase tracking-widest leading-none mt-2">
            Automated 3-day partner settlement cycles, item-value reconciliation &amp; payout audit trails
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-[12px] font-bold text-slate-700 focus:outline-none focus:border-slate-850 shadow-sm transition-colors cursor-pointer"
          >
            {PERIOD_OPTIONS.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>

          <button 
            onClick={handleCalculateSettlements}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-[12px] font-bold transition-all active:scale-95 flex items-center gap-2 shadow-sm"
          >
            <MdCalculate className="text-[18px]" />
            Calculate Settlements
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Gross Food / Item Sales */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3">Cycle Food Sales Value</p>
          <div className="flex items-center justify-between">
            <h3 className="text-3xl font-black text-slate-800 leading-none">₹{stats.totalRevenue.toLocaleString()}</h3>
            <span className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <MdPayments className="text-[20px]" />
            </span>
          </div>
        </div>

        {/* Platform Profit */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3 pl-1">Platform Commission</p>
          <div className="flex items-center justify-between pl-1">
            <h3 className="text-3xl font-black text-slate-800 leading-none">₹{platformProfitTotal.toLocaleString()}</h3>
            <span className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <MdTrendingUp className="text-[20px]" />
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
              <MdHourglassEmpty className="text-[20px]" />
            </span>
          </div>
        </div>

        {/* COD Cash to Collect */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500"></div>
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3 pl-1">COD Cash Held</p>
          <div className="flex items-center justify-between pl-1">
            <h3 className={`text-3xl font-black leading-none ${stats.codCashToCollect > 2000 ? "text-rose-600" : "text-slate-800"}`}>
              ₹{stats.codCashToCollect.toLocaleString()}
            </h3>
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              stats.codCashToCollect > 2000 ? "bg-rose-100 text-rose-600 animate-bounce" : "bg-rose-50 text-rose-500"
            }`}>
              <MdPriceCheck className="text-[20px]" />
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
              <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]" />
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
                <MdDownloadForOffline className="text-[18px]" />
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
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <p className="text-[11px] font-bold text-slate-400 uppercase">Platform Profit</p>
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider shrink-0">
                          Estimated (20% margin)
                        </span>
                      </div>
                      <h4 className="text-2xl font-black text-[#FF5C00]">₹{groceryAnalytics.profit.toLocaleString()}</h4>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Category-wise Sales Metrics</h4>
                    {groceryAnalytics.categories.length === 0 ? (
                      <p className="text-xs text-slate-400 font-bold py-6">No category-wise sales logged for this 3-day cycle.</p>
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
                  No grocery revenue metrics available for cycle {selectedPeriod}.
                </div>
              )}
            </div>
          ) : filteredPayouts.length === 0 ? (
            <div className="py-20 text-center text-slate-400 font-bold text-xs flex flex-col items-center justify-center">
              <MdAccountBalanceWallet className="text-[40px] text-slate-200 mb-2" />
              No settlement records found for this 3-day cycle.
            </div>
          ) : (
            /* --- RESTAURANT & DELIVERY TABLE VIEW --- */
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/20 border-b border-slate-100">
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Partner/Rider Details</th>
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Delivered Orders</th>
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    {activeTab === "restaurant" ? "Food Sales Value" : "Gross Revenue"}
                  </th>
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    {activeTab === "restaurant" ? "Commission" : "COD Cash Held"}
                  </th>
                  {activeTab === "restaurant" && (
                    <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      Adjustments
                    </th>
                  )}
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Net Payout</th>
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Payout Status</th>
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayouts.map((p) => {
                  const name = p.recipientType === "restaurant" ? p.restaurant?.name : p.deliveryBoy?.name;
                  const phone = p.recipientType === "restaurant" ? p.restaurant?.phone : p.deliveryBoy?.phone;
                  const hasAudit = p.auditLogs && p.auditLogs.length > 0;
                  
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

                      {/* Food Sales / Gross Revenue */}
                      <td className="py-4 px-6 font-bold text-slate-700">
                        ₹{p.totalRevenue.toLocaleString()}
                      </td>

                      {/* Commission/COD */}
                      <td className="py-4 px-6 font-bold">
                        {activeTab === "restaurant" ? (
                          <span className="text-slate-600">−₹{p.platformCommission.toLocaleString()}</span>
                        ) : (
                          <span className={`${p.codCollected > 2000 ? "text-rose-600" : "text-slate-600"}`}>
                            ₹{p.codCollected.toLocaleString()}
                          </span>
                        )}
                      </td>

                      {/* Adjustments */}
                      {activeTab === "restaurant" && (
                        <td className="py-4 px-6 font-bold text-slate-500">
                          {p.refundsAndAdjustments ? `−₹${p.refundsAndAdjustments.toLocaleString()}` : "₹0"}
                        </td>
                      )}

                      {/* Net Payables */}
                      <td className="py-4 px-6 font-black text-slate-900 text-base">
                        ₹{p.finalPayoutAmount.toLocaleString()}
                      </td>

                      {/* Status & UTR */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest uppercase ${
                          p.status === "paid"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : p.status === "processing"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : p.status === "failed"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
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
                          <p className="text-[10px] font-mono font-bold text-slate-600 mt-1">
                            UTR: {p.paymentDetails.transactionId}
                          </p>
                        )}
                        {hasAudit && (
                          <button
                            onClick={() => setShowAuditLogs(p)}
                            className="mt-1 flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-slate-600 underline"
                          >
                            <MdHistory /> View History
                          </button>
                        )}
                      </td>

                      {/* Settle Action */}
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => openSettleModal(p)}
                          className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors inline-flex items-center gap-1 ${
                            p.status === "paid"
                              ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                              : "bg-[#FF5C00] hover:bg-[#e05200] text-white shadow-sm"
                          }`}
                        >
                          <MdAccountBalance className="text-[14px]" />
                          {p.status === "paid" ? "Edit / Correct UTR" : "Mark as Paid"}
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

      {/* PHASE 3 & 4: MANDATORY UTR PAYMENT CONFIRMATION MODAL */}
      {selectedPayout && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
              <h3 className="font-black text-lg text-slate-900">
                {selectedPayout.status === "paid" ? "Update / Correct Payment" : "Confirm Settlement Payment"}
              </h3>
              <button 
                onClick={() => setSelectedPayout(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <MdClose className="text-xl" />
              </button>
            </div>

            <p className="text-sm font-semibold text-slate-600 mb-1">
              {selectedPayout.recipientType === "restaurant" ? selectedPayout.restaurant?.name : selectedPayout.deliveryBoy?.name}
            </p>
            <p className="text-xs text-slate-400 mb-4">
              Cycle: {formatPeriod(selectedPayout)}
            </p>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-5">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-500 font-medium">Food Sales / Gross:</span>
                <span className="text-xs font-bold text-slate-700">₹{selectedPayout.totalRevenue}</span>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-500 font-medium">Platform Commission:</span>
                <span className="text-xs font-bold text-rose-600">−₹{selectedPayout.platformCommission}</span>
              </div>
              {selectedPayout.refundsAndAdjustments > 0 && (
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-500 font-medium">Adjustments:</span>
                  <span className="text-xs font-bold text-rose-600">−₹{selectedPayout.refundsAndAdjustments}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 mt-2 flex justify-between items-center">
                <span className="text-xs font-black uppercase text-slate-700">Net Payable:</span>
                <span className="text-2xl font-black text-[#FF5C00]">₹{selectedPayout.finalPayoutAmount}</span>
              </div>
            </div>

            <form onSubmit={handleSaveSettlement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                <select
                  value={settleStatus}
                  onChange={(e) => setSettleStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-slate-800"
                >
                  <option value="paid">Paid (Confirmed Transfer)</option>
                  <option value="processing">Processing (On Hold)</option>
                  <option value="failed">Failed (Cancelled)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Transaction ID / UTR Number {settleStatus === "paid" && <span className="text-rose-500">*</span>}
                </label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="e.g. 123456789012"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-slate-800"
                  required={settleStatus === "paid"}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Bank transfer UTR or payment reference ID. Required for audit proof.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Notes / Correction Reason (Optional)
                </label>
                <textarea
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="e.g. Settled via NEFT / corrected UTR typo"
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-slate-800"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPayout(null)}
                  className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayout || (settleStatus === "paid" && !transactionId.trim())}
                  className="flex-1 py-3 bg-[#FF5C00] hover:bg-[#e05200] text-white font-black rounded-xl text-sm disabled:opacity-40 transition-colors shadow-md shadow-orange-500/20"
                >
                  {savingPayout ? "Saving..." : `Confirm Payment of ₹${selectedPayout.finalPayoutAmount}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDIT LOG MODAL */}
      {showAuditLogs && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-900">Settlement Audit Trail</h3>
                <p className="text-xs text-slate-400">
                  Payout #{showAuditLogs._id.slice(-6).toUpperCase()} · {formatPeriod(showAuditLogs)}
                </p>
              </div>
              <button 
                onClick={() => setShowAuditLogs(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <MdClose className="text-xl" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {(showAuditLogs.auditLogs || []).map((log, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] px-2 py-0.5 bg-white rounded border border-slate-200">
                      {log.status}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      {new Date(log.updatedAt).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="text-slate-600 font-medium mt-1">{log.notes || "No notes provided."}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Updated by: {log.updatedBy}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowAuditLogs(null)}
              className="w-full mt-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
