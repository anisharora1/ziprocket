"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import {
  MdAccountBalance,
  MdCheckCircle,
  MdHourglassEmpty,
  MdErrorOutline,
  MdContentCopy,
  MdReceiptLong,
  MdInfoOutline,
  MdArrowDownward
} from "react-icons/md";

interface PayoutItem {
  _id: string;
  periodStartDate: string;
  periodEndDate: string;
  periodIdentifier: string;
  totalOrders: number;
  totalRevenue: number;
  platformCommission: number;
  refundsAndAdjustments: number;
  adjustmentNotes?: string;
  finalPayoutAmount: number;
  status: "pending" | "processing" | "paid" | "failed";
  paymentDetails?: {
    transactionId?: string;
    paidAt?: string;
    notes?: string;
  };
  createdAt: string;
}

export default function SellerPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    if (!user || user.role !== "seller") {
      router.push("/auth/login");
      return;
    }

    const fetchPayouts = async () => {
      try {
        const res = await apiClient.get("/payouts/my-payouts");
        if (res.data.success) {
          setPayouts(res.data.payouts || []);
        }
      } catch (error) {
        console.error("Failed to fetch payouts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayouts();
  }, [user, authLoading, router]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUtr(text);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  const formatPeriodDates = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return "3-Day Cycle";
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startStr = start.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const endStr = end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    return `${startStr} – ${endStr}`;
  };

  const formatPaidDate = (dateStr?: string) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  // KPIs
  const totalPaidOut = payouts
    .filter(p => p.status === "paid")
    .reduce((sum, p) => sum + p.finalPayoutAmount, 0);

  const totalPending = payouts
    .filter(p => p.status !== "paid" && p.status !== "failed")
    .reduce((sum, p) => sum + p.finalPayoutAmount, 0);

  if (authLoading || isLoading) {
    return (
      <div className="p-8 text-center text-slate-500 font-medium">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3"></div>
        Loading your settlements...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8 pb-24">
      
      {/* Header */}
      <div>
        <h1 className="text-[28px] md:text-[32px] font-bold text-slate-900 tracking-tight leading-none mb-2">
          Restaurant Payouts &amp; Settlements
        </h1>
        <p className="text-[13px] md:text-[15px] text-slate-500">
          Track your automated 3-day settlement cycles, net earnings, and bank transfer receipts.
        </p>
      </div>

      {/* Info Callout Banner */}
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 md:p-5 flex items-start gap-3.5 text-emerald-950 shadow-sm">
        <MdInfoOutline className="text-emerald-700 text-[24px] shrink-0 mt-0.5" />
        <div className="text-xs md:text-[13px] leading-relaxed">
          <span className="font-bold text-emerald-900">How ZipRocket Settlements Work: </span>
          Payouts are generated automatically every 3 days based purely on <strong className="font-bold">Food Sales Value</strong> (item price × quantity). Delivery fees, platform fees, and customer packaging charges are strictly excluded from your sales computation.
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        
        {/* Total Settled */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100 relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Total Settled to Bank</p>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MdCheckCircle className="text-[18px]" />
            </div>
          </div>
          <h2 className="text-[32px] font-bold text-slate-900 tracking-tight leading-none mb-2">
            ₹{totalPaidOut.toLocaleString()}
          </h2>
          <p className="text-[11px] text-slate-400 font-medium">Successfully transferred to your account</p>
        </div>

        {/* Pending Settlement */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100 relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Pending Settlement</p>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <MdHourglassEmpty className="text-[18px]" />
            </div>
          </div>
          <h2 className="text-[32px] font-bold text-slate-900 tracking-tight leading-none mb-2">
            ₹{totalPending.toLocaleString()}
          </h2>
          <p className="text-[11px] text-amber-600 font-medium">Processing in next settlement cycle</p>
        </div>

        {/* Cycle Frequency */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100 sm:col-span-2 lg:col-span-1">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Settlement Cycle</p>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <MdAccountBalance className="text-[18px]" />
            </div>
          </div>
          <h2 className="text-[28px] font-bold text-slate-900 tracking-tight leading-none mb-2">
            Every 3 Days
          </h2>
          <p className="text-[11px] text-slate-400 font-medium">Automated bank direct transfer</p>
        </div>

      </div>

      {/* Settlements Roster */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-800">Settlement History</h3>

        {payouts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-100 shadow-sm">
            <MdReceiptLong className="text-[48px] text-slate-300 mb-3 mx-auto" />
            <p className="font-semibold text-sm">No settlement records found yet.</p>
            <p className="text-xs text-slate-400 mt-1">Settlements generate automatically as your delivered orders are processed.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {payouts.map((payout) => {
              const isPaid = payout.status === "paid";
              const isProcessing = payout.status === "processing";
              const isFailed = payout.status === "failed";
              const utr = payout.paymentDetails?.transactionId;
              const paidDate = formatPaidDate(payout.paymentDetails?.paidAt);

              return (
                <div
                  key={payout._id}
                  className="bg-white rounded-2xl p-5 md:p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100 transition-all hover:border-slate-200"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Settlement:</span>
                        <h4 className="text-base font-bold text-slate-900">
                          {formatPeriodDates(payout.periodStartDate, payout.periodEndDate)}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500">
                        Delivered Orders in Cycle: <strong className="text-slate-800 font-bold">{payout.totalOrders}</strong>
                      </p>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          isPaid
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : isProcessing
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : isFailed
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isPaid
                              ? "bg-emerald-500"
                              : isProcessing
                              ? "bg-blue-500"
                              : isFailed
                              ? "bg-rose-500"
                              : "bg-amber-500"
                          }`}
                        />
                        {isPaid ? "Paid" : isProcessing ? "Processing" : isFailed ? "Failed" : "Pending"}
                      </span>
                    </div>
                  </div>

                  {/* Financial Breakdown Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 font-medium block mb-1">Food Sales</span>
                      <span className="text-sm md:text-base font-bold text-slate-900">
                        ₹{payout.totalRevenue.toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 font-medium block mb-1">Commission</span>
                      <span className="text-sm md:text-base font-bold text-rose-600">
                        −₹{payout.platformCommission.toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 font-medium block mb-1">Adjustments</span>
                      <span className="text-sm md:text-base font-bold text-slate-700">
                        {payout.refundsAndAdjustments > 0 ? `−₹${payout.refundsAndAdjustments.toLocaleString()}` : "₹0"}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 font-medium block mb-1">Net Payout</span>
                      <span className="text-base md:text-lg font-black text-emerald-700">
                        ₹{payout.finalPayoutAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Footer: UTR & Settlement Date Proof */}
                  <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      {utr ? (
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="font-bold text-slate-700">UTR:</span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-bold">{utr}</span>
                          <button
                            onClick={() => copyToClipboard(utr)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors"
                            title="Copy UTR"
                          >
                            <MdContentCopy />
                          </button>
                          {copiedUtr === utr && (
                            <span className="text-[10px] font-bold text-emerald-600 animate-in fade-in">Copied!</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">UTR reference will appear once transferred</span>
                      )}

                      {paidDate && (
                        <div>
                          Paid on <strong className="text-slate-700 font-bold">{paidDate}</strong>
                        </div>
                      )}
                    </div>

                    {payout.paymentDetails?.notes && (
                      <div className="text-[11px] text-slate-400 italic">
                        Note: {payout.paymentDetails.notes}
                      </div>
                    )}
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
