"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/services/api";
import { 
  MdVerified, 
  MdSavings, 
  MdLeaderboard, 
  MdEditNote, 
  MdAddCircle, 
  MdPauseCircle, 
  MdPlayCircle, 
  MdEdit, 
  MdDelete 
} from "react-icons/md";

interface Zone {
  _id: string;
  name: string;
}

interface Restaurant {
  _id: string;
  name: string;
}

interface Coupon {
  _id: string;
  code: string;
  title: string;
  description: string;
  discountType: "flat" | "percentage";
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount: number;
  expiryDate: string;
  totalUsageLimit: number;
  perUserUsageLimit: number;
  isActive: boolean;
  applicableZones: Zone[] | string[];
  applicableRestaurants: Restaurant[] | string[];
  applicableFor?: "food" | "grocery" | "both";
  isFirstOrderOnly: boolean;
  isNewUserOnly: boolean;
  usedCount: number;
}

interface Analytics {
  totalRedemptions: number;
  totalDiscountGiven: number;
  popularCoupons: any[];
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>({
    totalRedemptions: 0,
    totalDiscountGiven: 0,
    popularCoupons: []
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);

  // Form Fields
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"flat" | "percentage">("flat");
  const [discountValue, setDiscountValue] = useState("");
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [totalUsageLimit, setTotalUsageLimit] = useState("1000");
  const [perUserUsageLimit, setPerUserUsageLimit] = useState("1");
  const [isActive, setIsActive] = useState(true);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([]);
  const [applicableFor, setApplicableFor] = useState<"food" | "grocery" | "both">("both");
  const [isFirstOrderOnly, setIsFirstOrderOnly] = useState(false);
  const [isNewUserOnly, setIsNewUserOnly] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [couponRes, zoneRes, restRes, analyticsRes] = await Promise.all([
        apiClient.get("/coupons"),
        apiClient.get("/delivery-zones"),
        apiClient.get("/restaurants?status=approved"),
        apiClient.get("/coupons/analytics")
      ]);

      if (couponRes.data.success) setCoupons(couponRes.data.coupons || []);
      if (zoneRes.data.success) setZones(zoneRes.data.zones || []);
      if (restRes.data.success) setRestaurants(restRes.data.restaurants || []);
      if (analyticsRes.data.success) setAnalytics(analyticsRes.data.analytics);
    } catch (err) {
      console.error("Failed to load coupons dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !title.trim() || !description.trim() || !discountValue || !expiryDate) {
      setError("Please complete all required fields.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    const payload = {
      code,
      title,
      description,
      discountType,
      discountValue: Number(discountValue),
      maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : undefined,
      minOrderAmount: minOrderAmount ? Number(minOrderAmount) : 0,
      expiryDate: new Date(expiryDate).toISOString(),
      totalUsageLimit: Number(totalUsageLimit),
      perUserUsageLimit: Number(perUserUsageLimit),
      isActive,
      applicableZones: selectedZones,
      applicableRestaurants: selectedRestaurants,
      applicableFor: applicableFor,
      isFirstOrderOnly,
      isNewUserOnly
    };

    try {
      if (editingCouponId) {
        const res = await apiClient.put(`/coupons/${editingCouponId}`, payload);
        if (res.data.success) {
          setSuccess("Coupon details updated successfully!");
          resetForm();
          fetchData();
        }
      } else {
        const res = await apiClient.post("/coupons", payload);
        if (res.data.success) {
          setSuccess("New Coupon successfully created!");
          resetForm();
          fetchData();
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save coupon.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (coupon: Coupon) => {
    setEditingCouponId(coupon._id);
    setCode(coupon.code);
    setTitle(coupon.title);
    setDescription(coupon.description);
    setDiscountType(coupon.discountType);
    setDiscountValue(coupon.discountValue.toString());
    setMaxDiscountAmount(coupon.maxDiscountAmount ? coupon.maxDiscountAmount.toString() : "");
    setMinOrderAmount(coupon.minOrderAmount.toString());
    setExpiryDate(new Date(coupon.expiryDate).toISOString().slice(0, 16));
    setTotalUsageLimit(coupon.totalUsageLimit.toString());
    setPerUserUsageLimit(coupon.perUserUsageLimit.toString());
    setIsActive(coupon.isActive);
    setApplicableFor(coupon.applicableFor || "both");
    setIsFirstOrderOnly(coupon.isFirstOrderOnly);
    setIsNewUserOnly(coupon.isNewUserOnly);
    
    // Resolve applicable zones ids
    setSelectedZones(coupon.applicableZones ? coupon.applicableZones.map((z: any) => typeof z === 'object' ? z._id : z) : []);
    setSelectedRestaurants(coupon.applicableRestaurants ? coupon.applicableRestaurants.map((r: any) => typeof r === 'object' ? r._id : r) : []);
    
    setError("");
    setSuccess("");
  };

  const resetForm = () => {
    setEditingCouponId(null);
    setCode("");
    setTitle("");
    setDescription("");
    setDiscountType("flat");
    setDiscountValue("");
    setMaxDiscountAmount("");
    setMinOrderAmount("");
    setExpiryDate("");
    setTotalUsageLimit("1000");
    setPerUserUsageLimit("1");
    setIsActive(true);
    setSelectedZones([]);
    setSelectedRestaurants([]);
    setApplicableFor("both");
    setIsFirstOrderOnly(false);
    setIsNewUserOnly(false);
  };

  const handleToggleState = async (couponId: string, currentActive: boolean) => {
    try {
      const res = await apiClient.patch(`/coupons/${couponId}/toggle`, {
        isActive: !currentActive
      });
      if (res.data.success) {
        setCoupons(coupons.map(c => c._id === couponId ? { ...c, isActive: !currentActive } : c));
      }
    } catch (err) {
      console.error("Failed to toggle coupon status:", err);
    }
  };

  const handleDelete = async (couponId: string) => {
    if (!confirm("Are you sure you want to permanently delete this coupon? Usages tracking history will be cleared.")) return;
    try {
      const res = await apiClient.delete(`/coupons/${couponId}`);
      if (res.data.success) {
        fetchData();
      }
    } catch (err) {
      console.error("Delete coupon failed:", err);
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 bg-[#fafafa] overflow-y-auto">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Coupons & Loyalty Desk</h2>
        <p className="text-xs font-semibold text-slate-400 mt-2 uppercase tracking-widest">
          Configure, activate, and track geofenced promotional discounts and offers
        </p>
      </div>

      {/* Analytics Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Usage */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Loyalty Performance</span>
            <MdVerified className="text-[#FF5C00] text-[18px]" />
          </div>
          <div>
            <h4 className="text-3xl font-black text-slate-800">{analytics.totalRedemptions}</h4>
            <p className="text-xs font-semibold text-slate-500 mt-1">Total Coupon Redemptions</p>
          </div>
        </div>

        {/* Discount Volume */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Savings Volume</span>
            <MdSavings className="text-emerald-600 text-[18px]" />
          </div>
          <div>
            <h4 className="text-3xl font-black text-emerald-600">₹{analytics.totalDiscountGiven.toLocaleString()}</h4>
            <p className="text-xs font-semibold text-slate-500 mt-1">Total Promotional Discounts Applied</p>
          </div>
        </div>

        {/* Top Performer Coupon */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Performer</span>
            <MdLeaderboard className="text-blue-600 text-[18px]" />
          </div>
          <div>
            <h4 className="text-lg font-black text-slate-800 leading-tight">
              {analytics.popularCoupons?.[0] ? `${analytics.popularCoupons[0].code} (${analytics.popularCoupons[0].usageCount} times)` : "None yet"}
            </h4>
            <p className="text-xs font-semibold text-slate-500 mt-1">Most Applied Promo Code</p>
          </div>
        </div>
      </div>

      {/* Main split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Creator Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit lg:col-span-1">
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${editingCouponId ? 'bg-amber-50 text-amber-600' : 'bg-orange-50 text-[#FF5C00]'}`}>
              {editingCouponId ? <MdEditNote className="text-[20px]" /> : <MdAddCircle className="text-[20px]" />}
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">{editingCouponId ? 'Edit Coupon' : 'Create Coupon'}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dynamic discount settings</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl text-center">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold rounded-xl text-center">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 col-span-2">
                <label className="block text-xs font-bold text-slate-500">Coupon Code *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. WELCOME50"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-[#FF5C00] focus:bg-white rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="block text-xs font-bold text-slate-500">Title *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. 50% Flat Off"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-[#FF5C00] focus:bg-white rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="block text-xs font-bold text-slate-500">Description *</label>
                <textarea 
                  required
                  rows={2}
                  placeholder="Promo description shown to customers..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-[#FF5C00] focus:bg-white rounded-xl text-xs font-semibold text-slate-800 focus:outline-none resize-none"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="block text-xs font-bold text-slate-500">Applicable Scope / Category *</label>
                <select
                  value={applicableFor}
                  onChange={(e) => setApplicableFor(e.target.value as "food" | "grocery" | "both")}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-[#FF5C00] focus:bg-white rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="both">Both Food & Grocery Store</option>
                  <option value="food">Food Delivery Only</option>
                  <option value="grocery">Grocery Store Only</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-500">Discount Type *</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as "flat" | "percentage")}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-[#FF5C00] focus:bg-white rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="flat">Flat ₹</option>
                  <option value="percentage">Percent %</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-500">Value *</label>
                <input 
                  type="number" 
                  min="0"
                  required
                  placeholder={discountType === 'flat' ? "50" : "20"}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-[#FF5C00] focus:bg-white rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-500">Max Cap ₹</label>
                <input 
                  type="number" 
                  min="0"
                  placeholder="Optional max discount"
                  value={maxDiscountAmount}
                  onChange={(e) => setMaxDiscountAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-[#FF5C00] focus:bg-white rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-500">Min Cart Subtotal</label>
                <input 
                  type="number" 
                  min="0"
                  placeholder="e.g. 199"
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-[#FF5C00] focus:bg-white rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="block text-xs font-bold text-slate-500">Expiry Date & Time *</label>
                <input 
                  type="datetime-local" 
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-[#FF5C00] focus:bg-white rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-500">Total Limit</label>
                <input 
                  type="number" 
                  min="1"
                  value={totalUsageLimit}
                  onChange={(e) => setTotalUsageLimit(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-[#FF5C00] focus:bg-white rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-500">Per-user Limit</label>
                <input 
                  type="number" 
                  min="1"
                  value={perUserUsageLimit}
                  onChange={(e) => setPerUserUsageLimit(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-[#FF5C00] focus:bg-white rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            {/* Zone Applicability */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500">Applicable Zones (Empty = Global)</label>
              <div className="border border-slate-200 rounded-xl p-2.5 max-h-24 overflow-y-auto bg-slate-50 space-y-1.5">
                {zones.map((zone) => {
                  const isSelected = selectedZones.includes(zone._id);
                  return (
                    <label key={zone._id} className="flex items-center gap-2 text-[11px] font-semibold text-slate-650 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          if (isSelected) setSelectedZones(selectedZones.filter(id => id !== zone._id));
                          else setSelectedZones([...selectedZones, zone._id]);
                        }}
                        className="accent-[#FF5C00] h-3.5 w-3.5"
                      />
                      {zone.name}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Restaurant Applicability */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500">Applicable Restaurants (Empty = Global)</label>
              <div className="border border-slate-200 rounded-xl p-2.5 max-h-24 overflow-y-auto bg-slate-50 space-y-1.5">
                {restaurants.map((restaurant) => {
                  const isSelected = selectedRestaurants.includes(restaurant._id);
                  return (
                    <label key={restaurant._id} className="flex items-center gap-2 text-[11px] font-semibold text-slate-650 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          if (isSelected) setSelectedRestaurants(selectedRestaurants.filter(id => id !== restaurant._id));
                          else setSelectedRestaurants([...selectedRestaurants, restaurant._id]);
                        }}
                        className="accent-[#FF5C00] h-3.5 w-3.5"
                      />
                      {restaurant.name}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Checkbox settings */}
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={isFirstOrderOnly}
                  onChange={(e) => setIsFirstOrderOnly(e.target.checked)}
                  className="accent-[#FF5C00]"
                />
                First Order Only Coupon
              </label>

              <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={isNewUserOnly}
                  onChange={(e) => setIsNewUserOnly(e.target.checked)}
                  className="accent-[#FF5C00]"
                />
                New Users Only Coupon
              </label>

              <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="accent-[#FF5C00]"
                />
                Coupon Active Toggle
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              {editingCouponId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-2.5 bg-slate-150 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl active:scale-95 transition-all text-center"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className={`py-2.5 text-white font-extrabold text-xs rounded-xl active:scale-95 transition-all shadow-md flex items-center justify-center disabled:opacity-50 ${
                  editingCouponId ? 'flex-[2] bg-amber-600 hover:bg-amber-700' : 'w-full bg-[#FF5C00] hover:bg-[#e05200] shadow-orange-500/10'
                }`}
              >
                {submitting ? "..." : editingCouponId ? "Update Coupon" : "Create Coupon"}
              </button>
            </div>
          </form>
        </div>

        {/* Coupons List Console */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col lg:col-span-2">
          <div className="p-5 border-b border-slate-100 bg-slate-50/40">
            <h3 className="font-extrabold text-sm text-slate-800">Coupons Database</h3>
            <p className="text-[11px] font-semibold text-slate-400">Total active promotional campaigns inside system</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="py-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Coupon Details</th>
                  <th className="py-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Scope Parameters</th>
                  <th className="py-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Usages</th>
                  <th className="py-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 text-xs font-semibold">
                      Loading promotional coupons database...
                    </td>
                  </tr>
                ) : coupons.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 text-xs font-bold">
                      No coupons configured. Create your first promo on the left!
                    </td>
                  </tr>
                ) : (
                  coupons.map((coupon) => {
                    const isExpired = new Date() > new Date(coupon.expiryDate);
                    return (
                      <tr key={coupon._id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-orange-50 text-[#FF5C00] border border-orange-100 font-black text-[11px] rounded-lg tracking-wider uppercase">
                              {coupon.code}
                            </span>
                            <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded ${
                              coupon.isActive && !isExpired ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                              {isExpired ? 'Expired' : coupon.isActive ? 'Active' : 'Paused'}
                            </span>
                            <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded ${
                              coupon.applicableFor === 'grocery' ? 'bg-purple-50 text-purple-700' : coupon.applicableFor === 'food' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {coupon.applicableFor === 'grocery' ? 'Grocery Store' : coupon.applicableFor === 'food' ? 'Food Only' : 'Universal'}
                            </span>
                          </div>
                          <p className="text-xs font-extrabold text-slate-800 mt-2">{coupon.title}</p>
                          <p className="text-[10px] text-slate-450 font-semibold line-clamp-1 mt-0.5">{coupon.description}</p>
                        </td>

                        <td className="py-4 px-6 text-xs text-slate-600 font-semibold space-y-1">
                          <p>Rate: <span className="font-extrabold text-slate-850">{coupon.discountType === 'flat' ? `₹${coupon.discountValue}` : `${coupon.discountValue}%`}</span></p>
                          <p>Min order: <span className="font-bold text-slate-850">₹{coupon.minOrderAmount}</span></p>
                          {coupon.maxDiscountAmount && <p>Max savings: <span className="font-bold text-slate-850">₹{coupon.maxDiscountAmount}</span></p>}
                          
                          {/* Show Applicable scope indicators */}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {coupon.isFirstOrderOnly && (
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[8px] font-black rounded uppercase">First Order</span>
                            )}
                            {coupon.applicableZones && coupon.applicableZones.length > 0 ? (
                              <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 text-[8px] font-black rounded uppercase">Zone Specific</span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-black rounded uppercase">Global Zones</span>
                            )}
                            {coupon.applicableRestaurants && coupon.applicableRestaurants.length > 0 ? (
                              <span className="px-1.5 py-0.5 bg-purple-50 text-purple-750 text-[8px] font-black rounded uppercase">Store Restrict</span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-black rounded uppercase">Global Stores</span>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-6 text-xs font-semibold text-slate-500 space-y-1">
                          <p>Used: <span className="font-black text-slate-800">{coupon.usedCount || 0} times</span></p>
                          <p className="text-[10px] text-slate-400">Cap: {coupon.totalUsageLimit}</p>
                        </td>

                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2.5">
                            <button
                              onClick={() => handleToggleState(coupon._id, coupon.isActive)}
                              className={`p-1.5 rounded-lg border text-slate-500 hover:text-[#FF5C00] bg-white transition-all`}
                              title={coupon.isActive ? "Pause Campaign" : "Resume Campaign"}
                            >
                              {coupon.isActive ? <MdPauseCircle className="text-[16px]" /> : <MdPlayCircle className="text-[16px]" />}
                            </button>
                            <button
                              onClick={() => handleStartEdit(coupon)}
                              className="p-1.5 bg-white border rounded-lg text-slate-500 hover:text-amber-600 transition-all"
                              title="Edit Parameters"
                            >
                              <MdEdit className="text-[16px]" />
                            </button>
                            <button
                              onClick={() => handleDelete(coupon._id)}
                              className="p-1.5 bg-white border rounded-lg text-slate-500 hover:text-rose-600 transition-all"
                              title="Delete Coupon"
                            >
                              <MdDelete className="text-[16px]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
