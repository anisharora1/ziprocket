"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/services/api";
import { 
  MdRefresh, 
  MdStorefront, 
  MdCheckCircle, 
  MdPending, 
  MdBlock, 
  MdSearch, 
  MdRestaurant, 
  MdCheck, 
  MdClose, 
  MdEdit, 
  MdStar, 
  MdVisibilityOff, 
  MdVerifiedUser, 
  MdDone, 
  MdLockOpen, 
  MdLock, 
  MdAssignment, 
  MdAccountBalance, 
  MdAnalytics,
  MdLocationOn,
  MdPinDrop,
  MdOpenInNew
} from "react-icons/md";

interface BankDetails {
  accountNumber: string;
  ifscCode: string;
}

interface Location {
  address: string;
  lat: number;
  lng: number;
}

interface UserOwner {
  _id: string;
  name: string;
  email: string;
}

interface Restaurant {
  _id: string;
  name: string;
  owner: UserOwner | string;
  ownerName: string;
  phone: string;
  location: Location;
  isActive: boolean;
  isBlocked: boolean;
  status: "pending" | "approved" | "rejected";
  commission: number;
  rating: number;
  totalOrders: number;
  cancellationCount: number;
  cuisines: string;
  fssaiNumber: string;
  panNumber: string;
  gstNumber?: string;
  bankDetails?: BankDetails;
  createdAt: string;
}

export default function RestaurantsAdminPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected" | "blocked">("all");
  
  // Commission editing states
  const [editingCommissionId, setEditingCommissionId] = useState<string | null>(null);
  const [tempCommission, setTempCommission] = useState<number>(5);

  // Expand row for details
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/restaurants");
      if (res.data.success) {
        setRestaurants(res.data.restaurants || []);
      }
    } catch (err) {
      console.error("Failed to fetch restaurants:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const handleToggleBlock = async (id: string, currentlyBlocked: boolean) => {
    try {
      const res = await apiClient.patch(`/restaurants/${id}/status`, {
        isBlocked: !currentlyBlocked
      });
      if (res.data.success) {
        setRestaurants(restaurants.map(r => r._id === id ? { ...r, isBlocked: !currentlyBlocked } : r));
      }
    } catch (err) {
      console.error("Failed to toggle block status:", err);
      alert("Failed to update block status.");
    }
  };

  const [editingLocationRes, setEditingLocationRes] = useState<Restaurant | null>(null);
  const [locationForm, setLocationForm] = useState({ address: "", lat: 0, lng: 0 });
  const [savingLocation, setSavingLocation] = useState(false);

  const startEditLocation = (restaurant: Restaurant) => {
    setEditingLocationRes(restaurant);
    setLocationForm({
      address: restaurant.location?.address || "",
      lat: restaurant.location?.lat || 0,
      lng: restaurant.location?.lng || 0
    });
  };

  const handleSaveLocation = async () => {
    if (!editingLocationRes) return;
    try {
      setSavingLocation(true);
      const res = await apiClient.put(`/restaurants/${editingLocationRes._id}`, {
        location: {
          address: locationForm.address,
          lat: Number(locationForm.lat),
          lng: Number(locationForm.lng)
        }
      });
      if (res.data.success) {
        setRestaurants(restaurants.map(r => 
          r._id === editingLocationRes._id 
            ? { ...r, location: { address: locationForm.address, lat: Number(locationForm.lat), lng: Number(locationForm.lng) } }
            : r
        ));
        setEditingLocationRes(null);
      }
    } catch (err) {
      console.error("Failed to update restaurant location:", err);
      alert("Failed to update restaurant location coordinates.");
    } finally {
      setSavingLocation(false);
    }
  };

  const handleSaveCommission = async (id: string) => {
    if (tempCommission < 0 || tempCommission > 100) {
      alert("Commission percentage must be between 0 and 100");
      return;
    }
    try {
      const res = await apiClient.patch(`/restaurants/${id}/status`, {
        commission: tempCommission
      });
      if (res.data.success) {
        setRestaurants(restaurants.map(r => r._id === id ? { ...r, commission: tempCommission } : r));
        setEditingCommissionId(null);
      }
    } catch (err) {
      console.error("Failed to update commission:", err);
      alert("Failed to update commission rate.");
    }
  };

  const startEditCommission = (restaurant: Restaurant) => {
    setEditingCommissionId(restaurant._id);
    setTempCommission(restaurant.commission || 5);
  };

  const getOwnerName = (r: Restaurant) => {
    if (r.ownerName) return r.ownerName;
    if (typeof r.owner === "object" && r.owner?.name) return r.owner.name;
    return "Partner Owner";
  };

  // Filter restaurants
  const filteredRestaurants = restaurants.filter(r => {
    // Search filter
    const matchesSearch = 
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getOwnerName(r).toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.phone.includes(searchQuery) ||
      (r.location?.address || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.cuisines || "").toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "blocked") return matchesSearch && r.isBlocked;
    if (statusFilter === "pending") return matchesSearch && r.status === "pending";
    if (statusFilter === "approved") return matchesSearch && r.status === "approved";
    if (statusFilter === "rejected") return matchesSearch && r.status === "rejected";

    return matchesSearch;
  });

  // Calculate real-time stats
  const totalPartners = restaurants.length;
  const activeNow = restaurants.filter(r => r.status === "approved" && !r.isBlocked).length;
  const blockedCount = restaurants.filter(r => r.isBlocked).length;
  const pendingVerification = restaurants.filter(r => r.status === "pending").length;

  return (
    <div className="flex-1 p-6 md:p-8 bg-slate-50/30 flex flex-col min-w-0">
      
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="max-w-2xl">
          <h2 className="text-[28px] font-black text-slate-800 tracking-tight leading-none mb-3">Restaurant Management</h2>
          <p className="text-[13px] font-semibold text-slate-400 uppercase tracking-widest leading-none mt-2">
            Verify compliance, manage commission rates, and audit partner credentials
          </p>
        </div>
        <button 
          onClick={fetchRestaurants}
          className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[13px] font-bold hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-2 shadow-sm"
        >
          <MdRefresh className="text-[18px]" />
          Refresh List
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Partners */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3">Total Partners</p>
          <div className="flex items-center justify-between">
            <h3 className="text-3xl font-black text-slate-800 leading-none">{totalPartners}</h3>
            <span className="w-9 h-9 bg-primary-container/10 text-primary-container rounded-xl flex items-center justify-center">
              <MdStorefront className="text-[20px]" />
            </span>
          </div>
        </div>

        {/* Active & Verified */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3">Active & Verified</p>
          <div className="flex items-center justify-between">
            <h3 className="text-3xl font-black text-slate-800 leading-none">{activeNow}</h3>
            <span className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <MdCheckCircle className="text-[20px]" />
            </span>
          </div>
        </div>

        {/* Pending Approval */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3">Pending Review</p>
          <div className="flex items-center justify-between">
            <h3 className="text-3xl font-black text-slate-800 leading-none">{pendingVerification}</h3>
            <span className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <MdPending className="text-[20px]" />
            </span>
          </div>
        </div>

        {/* Blocked Accounts */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3">Suspended / Blocked</p>
          <div className="flex items-center justify-between">
            <h3 className="text-3xl font-black text-slate-800 leading-none">{blockedCount}</h3>
            <span className="w-9 h-9 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
              <MdBlock className="text-[20px]" />
            </span>
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="bg-white min-h-[450px] rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden mb-8">
        
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30">
          <div className="relative w-full md:w-96">
            <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]" />
            <input
              type="text"
              placeholder="Search by name, owner, cuisines or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-[13px] font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-800 transition-colors shadow-sm"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Filter Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 bg-white border-2 border-slate-200 rounded-2xl text-[12px] font-bold text-slate-700 focus:outline-none focus:border-slate-800 shadow-sm transition-colors"
            >
              <option value="all">All Partners</option>
              <option value="pending">Pending Only</option>
              <option value="approved">Approved / Verified</option>
              <option value="rejected">Rejected Only</option>
              <option value="blocked">Suspended Only</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/20 border-b border-slate-100">
                <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Restaurant Details</th>
                <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Cuisines / Location</th>
                <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Commission</th>
                <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Status / Health</th>
                <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Compliance</th>
                <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Moderation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-400 font-semibold text-xs">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-3"></div>
                    Loading restaurant partners...
                  </td>
                </tr>
              ) : filteredRestaurants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-400 font-bold text-xs flex flex-col items-center justify-center">
                    <MdStorefront className="text-[40px] text-slate-200 mb-2" />
                    No restaurants found in database.
                  </td>
                </tr>
              ) : (
                filteredRestaurants.map((res) => {
                  const isExpanded = expandedId === res._id;
                  
                  return (
                    <React.Fragment key={res._id}>
                      <tr className="hover:bg-slate-50/40 transition-colors group">
                        {/* Restaurant Info */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/50 flex-shrink-0 flex items-center justify-center text-slate-400">
                              <MdRestaurant className="text-[24px]" />
                            </div>
                            <div>
                              <h4 className="text-[14px] font-black text-slate-800 leading-snug">{res.name}</h4>
                              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                                Owner: {getOwnerName(res)}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
                                Tel: +91 {res.phone}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Cuisines & Address */}
                        <td className="py-4 px-6">
                          <p className="text-[13px] font-black text-slate-700 line-clamp-1">{res.cuisines || "General"}</p>
                          <p className="text-[11px] font-bold text-slate-400 mt-1 leading-snug max-w-xs line-clamp-1">
                            {res.location?.address || "No Address Saved"}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {res.location?.lat && res.location?.lng ? (
                              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                {res.location.lat.toFixed(4)}, {res.location.lng.toFixed(4)}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                No Coordinates
                              </span>
                            )}
                            <button
                              onClick={() => startEditLocation(res)}
                              className="text-[11px] font-bold text-[#FF5C00] hover:underline inline-flex items-center gap-0.5"
                            >
                              <MdLocationOn className="text-[12px]" />
                              Edit Pin
                            </button>
                          </div>
                        </td>

                        {/* Commission Edit */}
                        <td className="py-4 px-6">
                          {editingCommissionId === res._id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={tempCommission}
                                onChange={(e) => setTempCommission(Number(e.target.value))}
                                className="w-16 px-2 py-1 text-xs font-bold border-2 border-slate-800 rounded-lg text-center"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveCommission(res._id)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg flex items-center justify-center"
                                title="Save"
                              >
                                <MdCheck className="text-[14px]" />
                              </button>
                              <button
                                onClick={() => setEditingCommissionId(null)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg flex items-center justify-center"
                                title="Cancel"
                              >
                                <MdClose className="text-[14px]" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 group/comm">
                              <span className="text-[13px] font-black text-slate-800">{res.commission || 5}%</span>
                              <button
                                onClick={() => startEditCommission(res)}
                                className="opacity-0 group-hover/comm:opacity-100 p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded transition-all"
                                title="Modify Commission Rate"
                              >
                                <MdEdit className="text-[14px]" />
                              </button>
                            </div>
                          )}
                          <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                            Rate Per Order
                          </p>
                        </td>

                        {/* Status Badges */}
                        <td className="py-4 px-6">
                          <div className="flex flex-col gap-1.5">
                            {/* Blocked Badge */}
                            {res.isBlocked ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase bg-rose-50 text-rose-700 w-fit">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                Suspended
                              </span>
                            ) : (
                              /* Verification Status Badge */
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase w-fit ${
                                res.status === "approved"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : res.status === "rejected"
                                  ? "bg-slate-100 text-slate-600"
                                  : "bg-amber-50 text-amber-700 animate-pulse"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  res.status === "approved"
                                    ? "bg-emerald-500"
                                    : res.status === "rejected"
                                    ? "bg-slate-400"
                                    : "bg-amber-500"
                                }`}></span>
                                {res.status}
                              </span>
                            )}
                            
                            {/* Rating / Orders */}
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                              <span className="flex items-center text-amber-500 gap-0.5">
                                <MdStar className="text-[12px]" />
                                {res.rating || "0.0"}
                              </span>
                              <span>•</span>
                              <span>{res.totalOrders || 0} Orders</span>
                            </div>
                          </div>
                        </td>

                        {/* Expand compliance */}
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : res._id)}
                            className={`px-3 py-1 bg-slate-50 border border-slate-200/60 hover:border-slate-800 text-slate-600 font-extrabold text-[11px] rounded-xl transition-all inline-flex items-center gap-1 ${
                              isExpanded ? "bg-slate-800 text-white border-slate-800" : ""
                            }`}
                          >
                            {isExpanded ? <MdVisibilityOff className="text-[14px]" /> : <MdVerifiedUser className="text-[14px]" />}
                            {isExpanded ? "Hide" : "Verify Compliance"}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6">
                          <div className="flex justify-end gap-2">
                            {/* Edit Location / Coordinates Override */}
                            <button
                              onClick={() => startEditLocation(res)}
                              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-extrabold text-[11px] rounded-xl transition-colors shadow-sm inline-flex items-center gap-1"
                              title="Override Latitude / Longitude"
                            >
                              <MdLocationOn className="text-[14px] text-[#FF5C00]" />
                              Edit Location
                            </button>

                            {/* Suspend / Reactivate action */}
                            <button
                              onClick={() => handleToggleBlock(res._id, res.isBlocked)}
                              className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] transition-colors border inline-flex items-center gap-1 ${
                                res.isBlocked
                                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-100"
                                  : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-100"
                              }`}
                            >
                              {res.isBlocked ? <MdLockOpen className="text-[14px]" /> : <MdLock className="text-[14px]" />}
                              {res.isBlocked ? "Reactivate" : "Suspend"}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Compliance Audit Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={6} className="p-6 border-b border-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-top-2 duration-200">
                              
                              {/* Box 1: FSSAI and Licenses */}
                              <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                                <h5 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                  <MdAssignment className="text-[16px] text-amber-500" />
                                  Licenses & Registrations
                                </h5>
                                <div className="space-y-2 text-[12px] font-semibold text-slate-600">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">FSSAI Number:</span>
                                    <span className="text-slate-800 font-bold">{res.fssaiNumber || "Not Provided"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">PAN Number:</span>
                                    <span className="text-slate-800 font-bold">{res.panNumber || "Not Provided"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">GST Number:</span>
                                    <span className="text-slate-800 font-bold">{res.gstNumber || "Not Registered"}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Box 2: Bank Account */}
                              <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                                <h5 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                  <MdAccountBalance className="text-[16px] text-emerald-600" />
                                  Settlement Account Details
                                </h5>
                                {res.bankDetails ? (
                                  <div className="space-y-2 text-[12px] font-semibold text-slate-600">
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Account No:</span>
                                      <span className="text-slate-800 font-bold">{res.bankDetails.accountNumber}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">IFSC Code:</span>
                                      <span className="text-slate-800 font-bold">{res.bankDetails.ifscCode}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Owner Name:</span>
                                      <span className="text-slate-800 font-bold">{getOwnerName(res)}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs font-semibold text-slate-400 py-2">Settlement information not onboarded.</p>
                                )}
                              </div>

                              {/* Box 3: Geocoded Location & Map Pin */}
                              <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                                <div className="flex justify-between items-center mb-3">
                                  <h5 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                                    <MdLocationOn className="text-[16px] text-[#FF5C00]" />
                                    Map Pin & Location
                                  </h5>
                                  <button
                                    onClick={() => startEditLocation(res)}
                                    className="text-[10px] font-bold text-[#FF5C00] hover:underline"
                                  >
                                    Edit
                                  </button>
                                </div>
                                <div className="space-y-2 text-[12px] font-semibold text-slate-600">
                                  <div>
                                    <span className="text-slate-400 block text-[10px] uppercase">Address:</span>
                                    <span className="text-slate-800 font-bold line-clamp-2">{res.location?.address || "None"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Coordinates:</span>
                                    <span className="text-slate-800 font-mono font-bold">
                                      {res.location?.lat ? `${res.location.lat.toFixed(4)}, ${res.location.lng.toFixed(4)}` : "0, 0"}
                                    </span>
                                  </div>
                                  {res.location?.lat && res.location?.lng ? (
                                    <div className="pt-1">
                                      <a
                                        href={`https://www.google.com/maps?q=${res.location.lat},${res.location.lng}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF5C00] hover:underline"
                                      >
                                        <MdOpenInNew className="text-[12px]" />
                                        Open in Maps
                                      </a>
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              {/* Box 4: Quick Statistics & Health */}
                              <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                                <h5 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                  <MdAnalytics className="text-[16px] text-rose-500" />
                                  Fulfillment Metrics
                                </h5>
                                <div className="space-y-2 text-[12px] font-semibold text-slate-600">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Total Fulfilled:</span>
                                    <span className="text-slate-800 font-bold">{res.totalOrders || 0} Orders</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Cancellation Rate:</span>
                                    <span className={`font-bold ${res.cancellationCount > 5 ? "text-rose-600 animate-pulse" : "text-slate-800"}`}>
                                      {res.cancellationCount || 0} Cancellations
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Created Date:</span>
                                    <span className="text-slate-800 font-bold">
                                      {new Date(res.createdAt).toLocaleDateString("en-IN", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric"
                                      })}
                                    </span>
                                  </div>
                                </div>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredRestaurants.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/20">
            <span className="text-[12px] font-bold text-slate-400">
              Showing {filteredRestaurants.length} of {restaurants.length} total partners
            </span>
            <div className="flex gap-2">
              <button 
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-400 cursor-not-allowed" 
                disabled
              >
                Previous
              </button>
              <button 
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-400 cursor-not-allowed" 
                disabled
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-[12px] text-slate-400 font-bold mt-auto border-t border-slate-100 pt-6 pb-2">
        <p>© 2026 ZipRocket Management Suite. All rights reserved.</p>
        <div className="flex gap-6 mt-4 sm:mt-0">
          <a href="#" className="hover:text-slate-800 transition-colors uppercase tracking-wider">Privacy Policy</a>
          <a href="#" className="hover:text-slate-800 transition-colors uppercase tracking-wider">Partner Terms</a>
          <a href="#" className="hover:text-slate-800 transition-colors uppercase tracking-wider">Audit Logs</a>
        </div>
      </div>

      {/* Edit Location & Coordinates Modal */}
      {editingLocationRes && (
        <div className="fixed inset-0 bg-slate-900/50 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setEditingLocationRes(null)}></div>
          <div className="bg-white rounded-2xl shadow-xl w-[90vw] md:w-[480px] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 relative z-10">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Location & Pin</h3>
                <p className="text-xs text-slate-500">{editingLocationRes.name}</p>
              </div>
              <button 
                onClick={() => setEditingLocationRes(null)}
                className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100"
              >
                <MdClose className="text-xl" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Address
                </label>
                <textarea
                  rows={3}
                  value={locationForm.address}
                  onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-slate-800"
                  placeholder="Full address of the restaurant..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={locationForm.lat}
                    onChange={(e) => setLocationForm({ ...locationForm, lat: e.target.value as any })}
                    className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 focus:outline-none focus:border-slate-800"
                    placeholder="e.g. 31.3260"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={locationForm.lng}
                    onChange={(e) => setLocationForm({ ...locationForm, lng: e.target.value as any })}
                    className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 focus:outline-none focus:border-slate-800"
                    placeholder="e.g. 75.5762"
                  />
                </div>
              </div>

              {Number(locationForm.lat) !== 0 && Number(locationForm.lng) !== 0 && (
                <div className="pt-2">
                  <a
                    href={`https://www.google.com/maps?q=${locationForm.lat},${locationForm.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF5C00] hover:underline"
                  >
                    <MdOpenInNew className="text-[14px]" />
                    Test coordinates in Google Maps
                  </a>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingLocationRes(null)}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLocation}
                disabled={savingLocation}
                className="px-5 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                {savingLocation ? "Saving..." : "Save Coordinates"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
