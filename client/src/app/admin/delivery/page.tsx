"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/services/api";

interface BankDetails {
  accountNumber: string;
  ifscCode: string;
}

interface User {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  isBlocked: boolean;
  role: string;
}

interface DeliveryProfile {
  _id: string;
  user: User;
  fullName: string;
  phone: string;
  address: string;
  vehicleType: "bike" | "scooter" | "bicycle" | "e-bike" | "other";
  vehicleNumber: string;
  idProofString: string;
  status: "pending" | "approved" | "rejected";
  isActive: boolean;
  isBlocked: boolean;
  email?: string;
  city: string;
  aadhaarNumber: string;
  licenseNumber?: string;
  panNumber: string;
  bankDetails: BankDetails;
  createdAt: string;
  rating?: number;
  activeOrdersCount?: number;
}

// Deterministic Unsplash photorealistic avatar profiles for fleet visualization
const profileAvatars = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150", // Female
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150", // Male 1
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150", // Male 2
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=150", // Female 2
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=150", // Male 3
];

export default function DeliveryAdminPage() {
  const [profiles, setProfiles] = useState<DeliveryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "pending" | "rejected" | "blocked" | "online" | "busy">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/admin/deliveries");
      if (res.data.success) {
        setProfiles(res.data.profiles || []);
      }
    } catch (err) {
      console.error("Failed to fetch delivery profiles:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: "approved" | "rejected") => {
    try {
      const res = await apiClient.patch(`/admin/deliveries/${id}`, {
        status: newStatus
      });
      if (res.data.success) {
        setProfiles(profiles.map(p => p._id === id ? { ...p, status: newStatus, user: { ...p.user, role: newStatus === "approved" ? "delivery" : p.user.role } } : p));
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      alert("Failed to update status.");
    }
  };

  const handleToggleBlock = async (id: string, currentlyBlocked: boolean) => {
    try {
      const res = await apiClient.patch(`/admin/deliveries/${id}`, {
        isBlocked: !currentlyBlocked
      });
      if (res.data.success) {
        setProfiles(profiles.map(p => p._id === id ? { ...p, isBlocked: !currentlyBlocked, user: { ...p.user, isBlocked: !currentlyBlocked } } : p));
      }
    } catch (err) {
      console.error("Failed to update block status:", err);
      alert("Failed to toggle block status.");
    }
  };

  // Deterministic avatar finder
  const getAvatarUrl = (index: number) => {
    return profileAvatars[index % profileAvatars.length];
  };

  // Real ratings from Mongoose backend DB records
  const getRating = (p: DeliveryProfile) => {
    return (p.rating !== undefined ? p.rating : 5.0).toFixed(1);
  };

  // Real workloads calculated dynamically by counting in-progress Delivery documents for each rider
  const getWorkload = (p: DeliveryProfile) => {
    if (p.isBlocked || p.status !== "approved") return { text: "N/A", pct: 0, color: "bg-slate-200" };
    if (!p.isActive) return { text: "Offline", pct: 0, color: "bg-slate-100" };
    
    const count = p.activeOrdersCount || 0;
    if (count === 0) return { text: "Idle (0/3)", pct: 0, color: "bg-slate-200" };
    if (count === 1) return { text: "Active (1/3)", pct: 33, color: "bg-blue-400" };
    if (count === 2) return { text: "Active (2/3)", pct: 66, color: "bg-blue-500" };
    return { text: "Full (3/3)", pct: 100, color: "bg-orange-500" };
  };

  // Filtered List
  const filteredProfiles = profiles.filter(p => {
    const matchesSearch =
      p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone.includes(searchQuery) ||
      (p.vehicleNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.city || "").toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === "all") return true;
    if (statusFilter === "blocked") return p.isBlocked;
    if (statusFilter === "pending") return p.status === "pending" && !p.isBlocked;
    if (statusFilter === "approved") return p.status === "approved" && !p.isBlocked;
    if (statusFilter === "rejected") return p.status === "rejected";
    if (statusFilter === "online") return p.status === "approved" && p.isActive && !p.isBlocked;
    if (statusFilter === "busy") return p.status === "approved" && p.isActive && !p.isBlocked && getWorkload(p).pct > 0;

    return true;
  });

  // Fleet Statistics
  const totalFleet = profiles.length;
  const onlineCount = profiles.filter(p => p.status === "approved" && p.isActive && !p.isBlocked).length;
  const busyCount = profiles.filter(p => p.status === "approved" && p.isActive && !p.isBlocked && getWorkload(p).pct > 0).length;
  const pendingCount = profiles.filter(p => p.status === "pending" && !p.isBlocked).length;

  return (
    <div className="flex-1 p-6 md:p-8 bg-slate-50/30 flex flex-col min-w-0">
      
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="max-w-2xl">
          <h2 className="text-[28px] font-black text-slate-800 tracking-tight leading-none mb-3">Fleet Logistics & Personnel</h2>
          <p className="text-[13px] font-semibold text-slate-400 uppercase tracking-widest leading-none mt-2">
            Verify rider compliance, manage delivery couriers, and monitor live workloads
          </p>
        </div>
        <button 
          onClick={fetchProfiles}
          className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[13px] font-bold hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-2 shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Refresh Fleet
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Couriers */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3">Total Fleet</p>
          <div className="flex items-center justify-between">
            <h3 className="text-3xl font-black text-slate-800 leading-none">{totalFleet}</h3>
            <span className="w-9 h-9 bg-primary-container/10 text-primary-container rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">directions_bike</span>
            </span>
          </div>
        </div>

        {/* Online Now */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3 pl-1">Online & Active</p>
          <div className="flex items-center justify-between pl-1">
            <h3 className="text-3xl font-black text-slate-800 leading-none">{onlineCount}</h3>
            <span className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">sensors</span>
            </span>
          </div>
        </div>

        {/* Busy / In-Transit */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3 pl-1">Busy / In-Transit</p>
          <div className="flex items-center justify-between pl-1">
            <h3 className="text-3xl font-black text-slate-800 leading-none">{busyCount}</h3>
            <span className="w-9 h-9 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">local_shipping</span>
            </span>
          </div>
        </div>

        {/* Pending Review */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3">Pending Onboarding</p>
          <div className="flex items-center justify-between">
            <h3 className="text-3xl font-black text-slate-800 leading-none">{pendingCount}</h3>
            <span className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">pending_actions</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="bg-white min-h-[450px] rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden mb-8">
        
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30">
          <div className="relative w-full md:w-96">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
            <input
              type="text"
              placeholder="Search by name, phone, vehicle no, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-[13px] font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-800 transition-colors shadow-sm"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status Mode:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 bg-white border-2 border-slate-200 rounded-2xl text-[12px] font-bold text-slate-700 focus:outline-none focus:border-slate-800 shadow-sm transition-colors"
            >
              <option value="all">All Fleet</option>
              <option value="online">Online / Active</option>
              <option value="busy">Busy Only</option>
              <option value="pending">Pending Onboarding</option>
              <option value="approved">Approved List</option>
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
                <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Rider Courier</th>
                <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Zone / Vehicle</th>
                <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Rating</th>
                <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Current Workload</th>
                <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Status / Mode</th>
                <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Compliance</th>
                <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Moderation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-slate-400 font-semibold text-xs">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-3"></div>
                    Loading fleet records...
                  </td>
                </tr>
              ) : filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-slate-400 font-bold text-xs">
                    <span className="material-symbols-outlined text-[40px] text-slate-200 block mb-2">directions_bike</span>
                    No courier fleet records found in database.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((p, index) => {
                  const isExpanded = expandedId === p._id;
                  const workload = getWorkload(p);
                  
                  return (
                    <React.Fragment key={p._id}>
                      <tr className="hover:bg-slate-50/40 transition-colors group">
                        {/* Rider Info */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-100 border border-slate-200/50 flex-shrink-0">
                              <img 
                                src={getAvatarUrl(index)} 
                                alt={p.fullName} 
                                className="w-full h-full object-cover" 
                              />
                            </div>
                            <div>
                              <h4 className="text-[14px] font-black text-slate-800 leading-snug">{p.fullName}</h4>
                              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                                Tel: +91 {p.phone}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
                                ID: #DX-{p._id.substring(p._id.length - 4).toUpperCase()}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Zone / Vehicle */}
                        <td className="py-4 px-6">
                          <p className="text-[13px] font-black text-slate-700 capitalize">
                            {p.vehicleType}
                          </p>
                          <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase leading-snug">
                            No: {p.vehicleNumber || "N/A"}
                          </p>
                          <p className="text-[10px] font-bold text-primary-container mt-0.5">
                            City: {p.city || "Tier-3 Zone"}
                          </p>
                        </td>

                        {/* Rating */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-1 text-[13px] font-black text-slate-800">
                            <span className="material-symbols-outlined text-[14px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                            {getRating(p)}
                          </div>
                          <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                            Rider Score
                          </p>
                        </td>

                        {/* Workload Progress */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2.5 w-44">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${workload.color}`}
                                style={{ width: `${workload.pct}%` }}
                              ></div>
                            </div>
                            <span className="text-[11px] font-extrabold text-slate-600 w-20 shrink-0">
                              {workload.text}
                            </span>
                          </div>
                          <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                            Real-time load
                          </p>
                        </td>

                        {/* Status Badges */}
                        <td className="py-4 px-6">
                          <div className="flex flex-col gap-1.5">
                            {p.isBlocked ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase bg-rose-50 text-rose-700 w-fit">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                Suspended
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase w-fit ${
                                p.status === "approved"
                                  ? p.isActive 
                                    ? "bg-emerald-50 text-emerald-700" 
                                    : "bg-slate-100 text-slate-600"
                                  : p.status === "rejected"
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-amber-50 text-amber-700 animate-pulse"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  p.status === "approved"
                                    ? p.isActive ? "bg-emerald-500" : "bg-slate-400"
                                    : p.status === "rejected"
                                    ? "bg-rose-500"
                                    : "bg-amber-500"
                                }`}></span>
                                {p.status === "approved" ? (p.isActive ? "Online" : "Offline") : p.status}
                              </span>
                            )}
                            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                              System State
                            </p>
                          </div>
                        </td>

                        {/* Expand compliance */}
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : p._id)}
                            className={`px-3 py-1 bg-slate-50 border border-slate-200/60 hover:border-slate-800 text-slate-600 font-extrabold text-[11px] rounded-xl transition-all inline-flex items-center gap-1 ${
                              isExpanded ? "bg-slate-800 text-white border-slate-800" : ""
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {isExpanded ? "visibility_off" : "verified_user"}
                            </span>
                            {isExpanded ? "Hide" : "Verify Courier"}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6">
                          <div className="flex justify-end gap-2">
                            {/* Approval actions for pending/rejected */}
                            {p.status !== "approved" && (
                              <button
                                onClick={() => handleUpdateStatus(p._id, "approved")}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-xl transition-colors shadow-sm inline-flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[14px]">done</span>
                                Approve
                              </button>
                            )}

                            {/* Rejection actions for pending/approved */}
                            {p.status !== "rejected" && (
                              <button
                                onClick={() => handleUpdateStatus(p._id, "rejected")}
                                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300 font-extrabold text-[11px] rounded-xl transition-colors inline-flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[14px]">close</span>
                                Reject
                              </button>
                            )}

                            {/* Suspend / Reactivate action */}
                            <button
                              onClick={() => handleToggleBlock(p._id, p.isBlocked)}
                              className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] transition-colors border inline-flex items-center gap-1 ${
                                p.isBlocked
                                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-100"
                                  : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-100"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {p.isBlocked ? "lock_open" : "lock"}
                              </span>
                              {p.isBlocked ? "Reactivate" : "Suspend"}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Courier Audit Details Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={7} className="p-6 border-b border-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-200">
                              
                              {/* Left box: Rider Profile & Vehicle details */}
                              <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                                <h5 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[16px] text-amber-500">sports_motorsports</span>
                                  Vehicle & Logistics
                                </h5>
                                <div className="space-y-2 text-[12px] font-semibold text-slate-600">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Vehicle Type:</span>
                                    <span className="text-slate-800 font-bold capitalize">{p.vehicleType}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">License Plate:</span>
                                    <span className="text-slate-800 font-bold">{p.vehicleNumber}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Rider Zone:</span>
                                    <span className="text-slate-800 font-bold">{p.city}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Home Address:</span>
                                    <span className="text-slate-800 font-bold text-right line-clamp-1">{p.address}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Center box: Legal Documents */}
                              <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                                <h5 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[16px] text-blue-600">badge</span>
                                  Legal Credentials
                                </h5>
                                <div className="space-y-2 text-[12px] font-semibold text-slate-600">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Aadhaar Card:</span>
                                    <span className="text-slate-800 font-bold">{p.aadhaarNumber || "Not Uploaded"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">PAN Card:</span>
                                    <span className="text-slate-800 font-bold">{p.panNumber || "Not Uploaded"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Driving License:</span>
                                    <span className="text-slate-800 font-bold">{p.licenseNumber || "N/A (Bicycle)"}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Right box: Settlement Account Details */}
                              <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                                <h5 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[16px] text-emerald-600">account_balance</span>
                                  Settlement Account Details
                                </h5>
                                {p.bankDetails ? (
                                  <div className="space-y-2 text-[12px] font-semibold text-slate-600">
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Bank Account No:</span>
                                      <span className="text-slate-800 font-bold">{p.bankDetails.accountNumber}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">IFSC Code:</span>
                                      <span className="text-slate-800 font-bold">{p.bankDetails.ifscCode}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Onboarding Date:</span>
                                      <span className="text-slate-800 font-bold">
                                        {new Date(p.createdAt).toLocaleDateString("en-IN", {
                                          day: "numeric",
                                          month: "short",
                                          year: "numeric"
                                        })}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs font-semibold text-slate-400 py-2">Settlement information not onboarded.</p>
                                )}
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
        {filteredProfiles.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/20">
            <span className="text-[12px] font-bold text-slate-400">
              Showing {filteredProfiles.length} of {profiles.length} total personnel
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

    </div>
  );
}
