"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/services/api";

interface Zone {
  _id: string;
  name: string;
  isActive: boolean;
  pincodes: string[];
}

interface Moderator {
  _id: string;
  name: string;
  phone: string;
  role: string;
  isBlocked: boolean;
  assignedZones?: Zone[] | string[];
  createdAt: string;
}

export default function AdminModerators() {
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Edit Mode state
  const [editingModId, setEditingModId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [zoneSearchQuery, setZoneSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchModeratorsAndZones = async () => {
    try {
      setLoading(true);
      const [modRes, zoneRes] = await Promise.all([
        apiClient.get("/admin/moderators"),
        apiClient.get("/delivery-zones")
      ]);
      
      if (modRes.data.success) {
        setModerators(modRes.data.moderators);
      }
      if (zoneRes.data.success) {
        setZones(zoneRes.data.zones || []);
      }
    } catch (err: any) {
      console.error("Failed to load moderators or zones:", err);
      setError("Failed to load system data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModeratorsAndZones();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || phone.length < 10) {
      setError("Please provide a valid Name and a 10-digit mobile number.");
      return;
    }

    if (selectedZones.length === 0) {
      setError("Every Grocery Moderator must be linked to one or multiple delivery zones.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (editingModId) {
        // Edit Mode
        const res = await apiClient.put(`/admin/moderators/${editingModId}`, {
          name,
          phone,
          assignedZones: selectedZones
        });
        if (res.data.success) {
          setSuccess("Grocery Moderator updated successfully!");
          setName("");
          setPhone("");
          setSelectedZones([]);
          setEditingModId(null);
          fetchModeratorsAndZones();
        }
      } else {
        // Create Mode
        const res = await apiClient.post("/admin/moderators", {
          name,
          phone,
          assignedZones: selectedZones
        });
        if (res.data.success) {
          setSuccess("Grocery Moderator created successfully! Credentials active.");
          setName("");
          setPhone("");
          setSelectedZones([]);
          fetchModeratorsAndZones();
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save moderator account.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (mod: Moderator) => {
    setEditingModId(mod._id);
    setName(mod.name);
    setPhone(mod.phone);
    setSelectedZones(mod.assignedZones ? mod.assignedZones.map((z: any) => typeof z === 'object' ? z._id : z) : []);
    setError("");
    setSuccess("");
  };

  const handleCancelEdit = () => {
    setEditingModId(null);
    setName("");
    setPhone("");
    setSelectedZones([]);
    setError("");
    setSuccess("");
  };

  const handleToggleZone = (zoneId: string) => {
    if (selectedZones.includes(zoneId)) {
      setSelectedZones(selectedZones.filter(id => id !== zoneId));
    } else {
      setSelectedZones([...selectedZones, zoneId]);
    }
  };

  const handleToggleBlock = async (moderatorId: string, currentStatus: boolean) => {
    try {
      const res = await apiClient.patch(`/admin/users/${moderatorId}/block-status`, {
        isBlocked: !currentStatus
      });
      if (res.data.success) {
        setModerators(moderators.map(m => m._id === moderatorId ? { ...m, isBlocked: !currentStatus } : m));
      }
    } catch (err) {
      console.error("Block toggle failed:", err);
      alert("Failed to update block status.");
    }
  };

  const filteredZones = zones.filter(zone =>
    zone.name.toLowerCase().includes(zoneSearchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Grocery Moderator Hub</h2>
        <p className="text-xs font-semibold text-slate-400 mt-2 uppercase tracking-widest">
          Admin portal to enroll, audit, and manage grocery moderators and zone routing
        </p>
      </div>

      {/* Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Creator / Editor Card */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-start lg:col-span-1 h-fit">
          <div className="flex items-center gap-3 mb-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${editingModId ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <span className="material-symbols-outlined text-[22px]">{editingModId ? 'edit_note' : 'person_add'}</span>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">{editingModId ? 'Edit Moderator' : 'Enroll Moderator'}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                {editingModId ? 'Modify Details & Zone Mapping' : 'Direct Account Creation'}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-100 text-red-600 text-[12px] font-bold rounded-2xl text-center">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-600 text-[12px] font-bold rounded-2xl text-center">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-500">Full Name *</label>
              <input 
                type="text" 
                required
                placeholder="e.g. Ramesh Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200/70 focus:border-emerald-500 focus:bg-white rounded-2xl text-xs font-bold text-slate-800 transition-colors focus:outline-none placeholder:text-slate-300"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-500">Phone Number *</label>
              <div className="flex bg-slate-50 border-2 border-slate-200/70 rounded-2xl overflow-hidden focus-within:border-emerald-500 focus-within:bg-white transition-colors">
                <div className="px-3 bg-slate-100 border-r border-slate-200 text-slate-500 font-extrabold text-xs flex items-center justify-center">+91</div>
                <input 
                  type="tel" 
                  required
                  placeholder="10-digit number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="flex-1 px-3 py-3 bg-transparent text-xs font-bold text-slate-800 focus:outline-none placeholder:text-slate-300"
                />
              </div>
            </div>

            {/* Delivery Zone Selector */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-slate-500">Assign Delivery Zones *</label>
                <span className="text-[10px] font-black bg-slate-100 text-slate-650 px-2 py-0.5 rounded-md uppercase">
                  {selectedZones.length} Selected
                </span>
              </div>
              
              {/* Mini Search within Zone box */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
                <input 
                  type="text"
                  placeholder="Search active zones..."
                  value={zoneSearchQuery}
                  onChange={(e) => setZoneSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 focus:border-emerald-400 focus:bg-white rounded-xl text-[11px] font-semibold text-slate-800 transition-colors focus:outline-none placeholder:text-slate-300"
                />
              </div>

              {/* Scrollable Checkbox List */}
              <div className="border border-slate-100 rounded-2xl p-3 max-h-40 overflow-y-auto space-y-2 bg-slate-50/50">
                {zones.length === 0 ? (
                  <p className="text-[10px] text-slate-400 text-center font-bold py-4">No zones available in the system.</p>
                ) : filteredZones.length === 0 ? (
                  <p className="text-[10px] text-slate-400 text-center font-bold py-4">No matching zones found.</p>
                ) : (
                  filteredZones.map((zone) => {
                    const isChecked = selectedZones.includes(zone._id);
                    return (
                      <label 
                        key={zone._id} 
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-bold cursor-pointer transition-all select-none ${
                          isChecked 
                            ? 'bg-emerald-50/40 border-emerald-200 text-emerald-850' 
                            : 'bg-white border-slate-100 hover:border-slate-200 text-slate-600'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          className="accent-emerald-600 h-3.5 w-3.5 cursor-pointer rounded"
                          checked={isChecked}
                          onChange={() => handleToggleZone(zone._id)}
                        />
                        <div className="flex-1">
                          <p className="font-extrabold leading-tight">{zone.name}</p>
                          {zone.pincodes && zone.pincodes.length > 0 && (
                            <p className="text-[8px] font-semibold text-slate-400 leading-none mt-0.5">
                              Pincodes: {zone.pincodes.slice(0, 3).join(", ")} {zone.pincodes.length > 3 ? "..." : ""}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {editingModId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold text-xs rounded-2xl active:scale-95 transition-all text-center"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={submitting || !name || phone.length < 10 || selectedZones.length === 0}
                className={`py-3.5 text-white font-extrabold text-xs rounded-2xl active:scale-95 transition-all shadow-md flex items-center justify-center disabled:opacity-50 disabled:active:scale-100 ${
                  editingModId ? 'flex-[2] bg-amber-600 hover:bg-amber-700 shadow-amber-600/10' : 'w-full bg-slate-800 hover:bg-slate-900'
                }`}
              >
                {submitting ? (
                  <span className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  editingModId ? "Save Changes" : "Register Moderator"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Moderator List Table */}
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden flex flex-col lg:col-span-2">
          <div className="p-5 border-b border-slate-100 bg-slate-50/20">
            <h3 className="font-extrabold text-sm text-slate-800">Enrolled Moderators</h3>
            <p className="text-[11px] font-semibold text-slate-400">Manage moderator accounts and their assigned service zones</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="py-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Moderator Info</th>
                  <th className="py-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Assigned Zones</th>
                  <th className="py-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
                  <th className="py-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 text-xs font-semibold">
                      <div className="w-6 h-6 border-3 border-slate-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-2"></div>
                      Loading personnel profiles...
                    </td>
                  </tr>
                ) : moderators.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 text-xs font-bold">
                      <span className="material-symbols-outlined text-[32px] text-slate-200 block mb-1">group</span>
                      No moderators enrolled yet. Create one on the left!
                    </td>
                  </tr>
                ) : (
                  moderators.map((mod) => (
                    <tr key={mod._id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="py-4 px-6">
                        <p className="text-xs font-extrabold text-slate-800">{mod.name}</p>
                        <p className="text-[10px] font-semibold text-slate-400 mt-0.5">+91 {mod.phone}</p>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1.5 max-w-[240px]">
                          {mod.assignedZones && mod.assignedZones.length > 0 ? (
                            (mod.assignedZones as any[]).map((zone) => {
                              const zoneId = typeof zone === 'object' ? zone._id : zone;
                              const zoneName = typeof zone === 'object' ? zone.name : "Zone";
                              return (
                                <span 
                                  key={zoneId} 
                                  className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100/50 font-extrabold text-[9px] rounded-md uppercase tracking-wider"
                                >
                                  <span className="material-symbols-outlined text-[9px]">location_on</span>
                                  {zoneName}
                                </span>
                              );
                            })
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 bg-rose-50 text-rose-700 font-extrabold text-[9px] rounded-md uppercase tracking-wider">
                              No Zones Assigned
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <button
                          onClick={() => handleToggleBlock(mod._id, mod.isBlocked)}
                          className={`px-2.5 py-1 rounded-full font-black text-[9px] uppercase tracking-wider flex items-center gap-1 transition-all ${
                            mod.isBlocked 
                              ? 'bg-rose-50 border border-rose-100 text-rose-600' 
                              : 'bg-emerald-50 border border-emerald-100 text-emerald-600'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${mod.isBlocked ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                          {mod.isBlocked ? 'Blocked' : 'Active'}
                        </button>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleStartEdit(mod)}
                            className="px-3 py-1.5 bg-slate-50 hover:bg-amber-50 hover:text-amber-700 border border-slate-200/60 hover:border-amber-200 rounded-xl font-bold text-[11px] text-slate-600 transition-all flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[13px]">edit</span>
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
