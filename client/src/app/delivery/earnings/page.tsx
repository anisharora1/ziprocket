"use client";

import { useState, useEffect } from "react";
import { apiClient } from "../../../services/api";
import {
  MdSync,
  MdPayments,
  MdPaid,
  MdCalendarToday,
  MdAccountBalanceWallet,
  MdCheckCircle,
  MdHourglassEmpty,
  MdCancel,
  MdSend,
  MdQrCodeScanner,
  MdReceiptLong,
  MdPriceCheck
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

interface CashSettlementItem {
  _id: string;
  type: "cash_handover" | "digital_payment";
  amount: number;
  transactionId?: string;
  paymentDate?: string;
  notes?: string;
  status: "pending" | "confirmed" | "rejected";
  confirmedBy?: {
    name: string;
  };
  confirmedAt?: string;
  createdAt: string;
}

export default function DeliveryEarningsPage() {
  const [completedDeliveries, setCompletedDeliveries] = useState<DeliveryRecord[]>([]);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [totalDeliveries, setTotalDeliveries] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [meta, setMeta] = useState<{ total: number; page: number; pages: number; limit: number }>({
    total: 0,
    page: 1,
    pages: 1,
    limit: 20,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<any>(null);

  // Cash Handover / Settlement State
  const [settlements, setSettlements] = useState<CashSettlementItem[]>([]);
  const [loadingSettlements, setLoadingSettlements] = useState<boolean>(false);
  const [settlementType, setSettlementType] = useState<"cash_handover" | "digital_payment">("cash_handover");
  const [settlementAmount, setSettlementAmount] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [settlementNotes, setSettlementNotes] = useState<string>("");
  const [submittingSettlement, setSubmittingSettlement] = useState<boolean>(false);
  const [settlementSuccess, setSettlementSuccess] = useState<string | null>(null);
  const [settlementError, setSettlementError] = useState<string | null>(null);

  const fetchSettlements = async () => {
    try {
      setLoadingSettlements(true);
      const res = await apiClient.get("/delivery-ops/settlements/my");
      if (res.data.success) {
        setSettlements(res.data.settlements || []);
      }
    } catch (err) {
      console.error("Failed to load courier settlements:", err);
    } finally {
      setLoadingSettlements(false);
    }
  };

  const fetchEarningsData = async (currentPage = page) => {
    try {
      const [statsRes, historyRes, profileRes] = await Promise.all([
        apiClient.get("/delivery/my-earnings-stats"),
        apiClient.get(`/delivery/my-deliveries?type=completed&page=${currentPage}&limit=20`),
        apiClient.get("/delivery/profile/my-profile")
      ]);

      if (statsRes.data.success) {
        setTotalEarnings(statsRes.data.totalEarnings || 0);
        setTotalDeliveries(statsRes.data.totalDeliveries || 0);
      }
      if (historyRes.data.success) {
        setCompletedDeliveries(historyRes.data.deliveries || []);
        if (historyRes.data.meta) {
          setMeta(historyRes.data.meta);
        }
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
    fetchEarningsData(page);
    fetchSettlements();
  }, [page]);

  const handleSettlementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettlementError(null);
    setSettlementSuccess(null);

    const amountNum = parseFloat(settlementAmount);
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      setSettlementError("Please enter a valid positive amount.");
      return;
    }

    if (settlementType === "digital_payment" && !transactionId.trim()) {
      setSettlementError("Please provide a UTR / Transaction reference ID for digital payments.");
      return;
    }

    try {
      setSubmittingSettlement(true);
      const payload = {
        type: settlementType,
        amount: amountNum,
        transactionId: settlementType === "digital_payment" ? transactionId.trim() : undefined,
        paymentDate: settlementType === "digital_payment" ? paymentDate : undefined,
        notes: settlementNotes.trim() || undefined
      };

      const res = await apiClient.post("/delivery-ops/settlements", payload);
      if (res.data.success) {
        setSettlementSuccess(`Settlement of ₹${amountNum.toLocaleString()} submitted for admin confirmation!`);
        setSettlementAmount("");
        setTransactionId("");
        setSettlementNotes("");
        fetchSettlements();
      } else {
        setSettlementError(res.data.message || "Failed to submit cash handover.");
      }
    } catch (err: any) {
      setSettlementError(err.response?.data?.message || "Failed to submit cash handover.");
    } finally {
      setSubmittingSettlement(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <MdSync className="text-[40px] text-emerald-600 animate-spin" />
        <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Compiling Statement...</p>
      </div>
    );
  }

  // Group current page deliveries by day
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
      const earnings = deliveries.reduce((sum, d) => sum + (d.earnings || 0), 0);
      return {
        dateString,
        count: deliveries.length,
        earnings,
        deliveries
      };
    });
  };

  const dailyGroups = groupEarningsByDay();
  const tripAverage = totalDeliveries > 0 ? Math.round(totalEarnings / totalDeliveries) : 45;

  return (
    <div className="p-4 max-w-2xl mx-auto flex flex-col gap-6 pt-6 relative">
      <div className="flex flex-col">
        <h1 className="text-[22px] font-black text-slate-800 leading-none">EARNINGS & OPERATIONS</h1>
        <p className="text-slate-400 text-xs font-bold mt-1.5 uppercase tracking-wide">Track payouts, cash handovers, and daily trips</p>
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
              <span className="text-[36px] font-black leading-none">₹{totalEarnings.toLocaleString()}</span>
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
          <span className="text-[18px] font-black text-emerald-600">₹{tripAverage}</span>
        </div>
        <div className="bg-white rounded-[20px] p-4 border border-slate-100/80 shadow-sm text-center">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Status</span>
          <span className="text-[12px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg mt-1 inline-block uppercase tracking-wider">Active</span>
        </div>
      </div>

      {/* ─── CASH HANDOVER & REMITTANCE SECTION ─── */}
      <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <MdAccountBalanceWallet className="text-[22px]" />
            </div>
            <div>
              <h2 className="text-[15px] font-black text-slate-800 leading-tight">Log Cash Handover</h2>
              <p className="text-slate-400 text-xs font-semibold">Report COD cash or UPI remittance to the admin</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg uppercase tracking-wide">
            Self-Reported
          </span>
        </div>

        {settlementSuccess && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <MdCheckCircle className="text-[18px] text-emerald-600 shrink-0" />
            <span>{settlementSuccess}</span>
          </div>
        )}

        {settlementError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
            <MdCancel className="text-[18px] text-rose-600 shrink-0" />
            <span>{settlementError}</span>
          </div>
        )}

        <form onSubmit={handleSettlementSubmit} className="space-y-4">
          {/* Handover Type Toggle */}
          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => setSettlementType("cash_handover")}
              className={`py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                settlementType === "cash_handover"
                  ? "bg-white text-slate-800 shadow-sm border border-slate-200/80"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <MdPaid className="text-[16px]" />
              Cash Handover
            </button>
            <button
              type="button"
              onClick={() => setSettlementType("digital_payment")}
              className={`py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                settlementType === "digital_payment"
                  ? "bg-white text-slate-800 shadow-sm border border-slate-200/80"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <MdQrCodeScanner className="text-[16px]" />
              Digital (UPI / Bank)
            </button>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Settlement Amount (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">₹</span>
              <input
                type="number"
                step="any"
                min="1"
                placeholder="Enter amount (e.g. 500)"
                value={settlementAmount}
                onChange={(e) => setSettlementAmount(e.target.value)}
                required
                className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          {/* Conditional Digital Fields */}
          {settlementType === "digital_payment" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 animate-in fade-in duration-200">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  UTR / Transaction ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 423984712093"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  required={settlementType === "digital_payment"}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          )}

          {/* Notes Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Notes / Description (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Handed to manager / Transferred via PhonePe"
              value={settlementNotes}
              onChange={(e) => setSettlementNotes(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={submittingSettlement}
            className="w-full py-3.5 bg-gradient-to-r from-slate-900 to-slate-800 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 hover:from-slate-800 hover:to-slate-700 transition-all shadow-md active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submittingSettlement ? (
              <>
                <MdSync className="text-[18px] animate-spin" />
                Submitting Handover...
              </>
            ) : (
              <>
                <MdSend className="text-[16px]" />
                Submit for Confirmation
              </>
            )}
          </button>
        </form>

        {/* ─── SETTLEMENT LOG HISTORY ─── */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Settlement History</h3>
            <span className="text-[11px] font-bold text-slate-400">{settlements.length} Records</span>
          </div>

          {loadingSettlements ? (
            <div className="py-6 text-center text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
              <MdSync className="animate-spin text-lg" /> Loading handovers...
            </div>
          ) : settlements.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-xs font-bold text-slate-500">No cash handover records yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Submit cash or UPI settlements above to log handovers</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {settlements.map((s) => (
                <div
                  key={s._id}
                  className="bg-slate-50/70 border border-slate-100 rounded-2xl p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900 leading-none">₹{s.amount.toLocaleString()}</span>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                        {s.type === "cash_handover" ? "Cash" : "Digital"}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 font-medium flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>{new Date(s.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      {s.transactionId && (
                        <span className="font-mono text-[10px] text-slate-600 bg-slate-200/60 px-1.5 py-0.5 rounded">
                          UTR: {s.transactionId}
                        </span>
                      )}
                    </div>
                    {s.notes && <p className="text-[11px] text-slate-500 italic truncate">{s.notes}</p>}
                  </div>

                  <div className="text-right shrink-0">
                    {s.status === "pending" && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-xl">
                        <MdHourglassEmpty className="text-xs" /> Pending
                      </span>
                    )}
                    {s.status === "confirmed" && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-xl">
                        <MdCheckCircle className="text-xs" /> Confirmed
                      </span>
                    )}
                    {s.status === "rejected" && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200/60 px-2.5 py-1 rounded-xl">
                        <MdCancel className="text-xs" /> Rejected
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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

        {/* Pagination Controls */}
        {!loading && meta.pages > 1 && (
          <div className="flex items-center justify-between px-2 pt-2">
            <span className="text-[12px] font-semibold text-slate-500">
              Page {meta.page} of {meta.pages} · {meta.total} total completed
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
                disabled={page >= meta.pages}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
