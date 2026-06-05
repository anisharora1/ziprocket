"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "@/services/api";

interface ZoneData {
  _id?: string;
  name: string;
  isActive: boolean;
  pincodes: string[];
  center: { lat: number; lng: number };
  radiusKm: number;
  baseDeliveryFee: number;
  baseDistanceKm: number;
  extraFeePerKm: number;
  minDeliveryFee: number;
  maxDeliveryFee: number;
  freeDeliveryThreshold: number;
  smallOrderThreshold: number;
  smallOrderFee: number;
  smallOrderFeeActive: boolean;
  platformFee: number;
  platformFeeActive: boolean;
  gstPercentage: number;
  gstActive: boolean;
  packagingCharge: number;
  packagingChargeActive: boolean;
  convenienceFee: number;
  convenienceFeeActive: boolean;
  surgeMultiplier: number;
  surgeActive: boolean;
}

const emptyZone: ZoneData = {
  name: "",
  isActive: true,
  pincodes: [],
  center: { lat: 28.7041, lng: 77.1025 },
  radiusKm: 10,
  baseDeliveryFee: 20,
  baseDistanceKm: 3,
  extraFeePerKm: 5,
  minDeliveryFee: 20,
  maxDeliveryFee: 150,
  freeDeliveryThreshold: 299,
  smallOrderThreshold: 100,
  smallOrderFee: 10,
  smallOrderFeeActive: false,
  platformFee: 5,
  platformFeeActive: true,
  gstPercentage: 5,
  gstActive: true,
  packagingCharge: 10,
  packagingChargeActive: false,
  convenienceFee: 2,
  convenienceFeeActive: false,
  surgeMultiplier: 1.0,
  surgeActive: false
};

export default function AdminZonesPage() {
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentZone, setCurrentZone] = useState<ZoneData>(emptyZone);
  const [pincodesInput, setPincodesInput] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchZones = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/delivery-zones");
      if (res.data.success) {
        setZones(res.data.zones || []);
      }
    } catch (err) {
      console.error("Failed to fetch delivery zones:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  const handleOpenCreate = () => {
    setCurrentZone(emptyZone);
    setPincodesInput("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (zone: ZoneData) => {
    setCurrentZone(zone);
    setPincodesInput(zone.pincodes.join(", "));
    setIsModalOpen(true);
  };

  const handleToggleActive = async (zone: ZoneData) => {
    try {
      const updatedZone = { ...zone, isActive: !zone.isActive };
      const res = await apiClient.put(`/delivery-zones/${zone._id}`, updatedZone);
      if (res.data.success) {
        setZones(prev => prev.map(z => z._id === zone._id ? { ...z, isActive: !zone.isActive } : z));
      }
    } catch (err) {
      console.error("Failed to toggle zone activity status:", err);
      alert("Failed to update status.");
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm("Are you sure you want to delete this zone? This action is irreversible.")) return;
    try {
      const res = await apiClient.delete(`/delivery-zones/${zoneId}`);
      if (res.data.success) {
        setZones(prev => prev.filter(z => z._id !== zoneId));
        setIsModalOpen(false);
        alert("Zone deleted successfully.");
      }
    } catch (err) {
      console.error("Failed to delete delivery zone:", err);
      alert("Failed to delete zone.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    // Parse pincodes
    const pincodesArray = pincodesInput
      .split(",")
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const payload = {
      ...currentZone,
      pincodes: pincodesArray
    };

    try {
      let res;
      if (currentZone._id) {
        // Edit Mode
        res = await apiClient.put(`/delivery-zones/${currentZone._id}`, payload);
      } else {
        // Create Mode
        res = await apiClient.post("/delivery-zones", payload);
      }

      if (res.data.success) {
        alert(currentZone._id ? "Delivery zone updated successfully!" : "Delivery zone created successfully!");
        setIsModalOpen(false);
        fetchZones();
      }
    } catch (err: any) {
      console.error("Failed to save delivery zone:", err);
      alert(err.response?.data?.message || "Failed to save delivery zone.");
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setCurrentZone(prev => ({ ...prev, [name]: checked }));
    } else if (name === "lat" || name === "lng") {
      const val = parseFloat(value) || 0;
      setCurrentZone(prev => ({
        ...prev,
        center: { ...prev.center, [name]: val }
      }));
    } else {
      const val = type === "number" ? (parseFloat(value) || 0) : value;
      setCurrentZone(prev => ({ ...prev, [name]: val }));
    }
  };

  if (loading && zones.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#fafafa] gap-3">
        <span className="material-symbols-outlined text-[40px] text-primary animate-spin">sync</span>
        <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Loading zones panel...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 md:space-y-8 bg-[#fafafa] min-h-screen font-sans">
      
      {/* Dashboard Header */}
      <div className="flex justify-between items-end">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-[#FF5C00] uppercase mb-2">OPERATIONAL CONTROL</p>
          <h2 className="text-[28px] font-bold text-slate-900 tracking-tight leading-none">Zones & Settings</h2>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-[#FF5C00] hover:bg-[#e05200] px-5 py-3 rounded-2xl text-xs font-black text-white uppercase tracking-wider shadow-lg shadow-[#FF5C00]/25 transition-all active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
          Create Zone
        </button>
      </div>

      {/* ZONES LIST GRID */}
      {zones.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 flex flex-col items-center justify-center text-center py-20 border border-slate-200/80 shadow-sm w-[576px] max-w-full mx-auto my-12">
          <span className="material-symbols-outlined text-[48px] text-slate-350 mb-4 animate-pulse">map</span>
          <h3 className="font-extrabold text-slate-700 text-[18px] leading-none">No active zones defined</h3>
          <p className="text-slate-400 text-xs font-semibold max-w-[320px] mx-auto leading-relaxed mt-2.5 mb-8">
            Operating zones are required to filter listings, claim logistics, and calculate dynamic checkout fares.
          </p>
          <button 
            onClick={handleOpenCreate}
            className="px-6 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-800 transition-all shadow-md active:scale-95"
          >
            Create Initial Zone
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {zones.map((zone) => (
            <div key={zone._id} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-all gap-5">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{zone.name}</h3>
                    <p className="text-[10px] text-[#FF5C00] font-black uppercase tracking-widest mt-1">
                      {zone.radiusKm} KM radius Geofence
                    </p>
                  </div>
                  
                  {/* Status Toggle Button */}
                  <button 
                    onClick={() => handleToggleActive(zone)}
                    className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors ${
                      zone.isActive 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                        : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}
                  >
                    {zone.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>

                <div className="border-t border-slate-50 pt-3 space-y-2 text-xs font-semibold text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-450">Active Pincodes:</span>
                    <span className="text-slate-850 max-w-[70%] truncate text-right font-bold">{zone.pincodes.join(", ") || "None"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-450">Base Delivery Fee:</span>
                    <span className="text-slate-850 font-bold">₹{zone.baseDeliveryFee} (up to {zone.baseDistanceKm} km)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-450">Per KM Charge:</span>
                    <span className="text-slate-850 font-bold">₹{zone.extraFeePerKm}/km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-450">GST & platform Fee:</span>
                    <span className="text-slate-850 font-bold">
                      {zone.gstActive ? `${zone.gstPercentage}% GST` : 'No GST'} • {zone.platformFeeActive ? `₹${zone.platformFee} Platform` : 'No Platform Fee'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-450">Surge Multiplier:</span>
                    <span className={`font-black ${zone.surgeActive ? 'text-amber-600' : 'text-slate-850'}`}>
                      {zone.surgeActive ? `${zone.surgeMultiplier}x Active` : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-50 pt-4 flex gap-3">
                <button
                  onClick={() => handleOpenEdit(zone)}
                  className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-slate-700 text-xs font-black uppercase tracking-wider transition-all active:scale-98 text-center flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Edit Settings
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EDIT/CREATE SLIDE-OVER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-end p-0 md:p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl h-full md:h-[95vh] md:rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {currentZone._id ? `Edit Zone: ${currentZone.name}` : "Create New Operating Zone"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Define geographical boundaries, fees, taxes and surge toggles</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body / Scroll Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              
              {/* SECTION 1: GEOGRAPHIC */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5">1. Geographic Boundaries</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">Zone Name</label>
                    <input 
                      required
                      type="text"
                      name="name"
                      value={currentZone.name}
                      onChange={handleInputChange}
                      placeholder="e.g. Benipatti Zone"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/10 focus:border-[#FF5C00] transition-all text-xs font-semibold"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">Pincodes (Comma separated)</label>
                    <input 
                      required
                      type="text"
                      value={pincodesInput}
                      onChange={(e) => setPincodesInput(e.target.value)}
                      placeholder="e.g. 847223, 847224"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/10 focus:border-[#FF5C00] transition-all text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">Center Latitude</label>
                    <input 
                      required
                      type="number"
                      step="any"
                      name="lat"
                      value={currentZone.center.lat}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/10 focus:border-[#FF5C00] transition-all text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">Center Longitude</label>
                    <input 
                      required
                      type="number"
                      step="any"
                      name="lng"
                      value={currentZone.center.lng}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/10 focus:border-[#FF5C00] transition-all text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">Geofence Radius (KM)</label>
                    <input 
                      required
                      type="number"
                      name="radiusKm"
                      value={currentZone.radiusKm}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/10 focus:border-[#FF5C00] transition-all text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: CORE DELIVERY PRICING */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5">2. Core Delivery Charges</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">Base Delivery Fee (₹)</label>
                    <input 
                      required
                      type="number"
                      name="baseDeliveryFee"
                      value={currentZone.baseDeliveryFee}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/10 focus:border-[#FF5C00] transition-all text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">Base Distance Cover (KM)</label>
                    <input 
                      required
                      type="number"
                      name="baseDistanceKm"
                      value={currentZone.baseDistanceKm}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/10 focus:border-[#FF5C00] transition-all text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">Extra Per KM Charge (₹)</label>
                    <input 
                      required
                      type="number"
                      name="extraFeePerKm"
                      value={currentZone.extraFeePerKm}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/10 focus:border-[#FF5C00] transition-all text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">Free Delivery Threshold (₹)</label>
                    <input 
                      required
                      type="number"
                      name="freeDeliveryThreshold"
                      value={currentZone.freeDeliveryThreshold}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/10 focus:border-[#FF5C00] transition-all text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">Minimum Delivery Cap (₹)</label>
                    <input 
                      required
                      type="number"
                      name="minDeliveryFee"
                      value={currentZone.minDeliveryFee}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/10 focus:border-[#FF5C00] transition-all text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">Maximum Delivery Cap (₹)</label>
                    <input 
                      required
                      type="number"
                      name="maxDeliveryFee"
                      value={currentZone.maxDeliveryFee}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/10 focus:border-[#FF5C00] transition-all text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: HANDLING CHARGES */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">3. Small Order Fees</h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      name="smallOrderFeeActive"
                      checked={currentZone.smallOrderFeeActive}
                      onChange={handleInputChange}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FF5C00]"></div>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">Small Order Threshold (₹)</label>
                    <input 
                      required
                      type="number"
                      name="smallOrderThreshold"
                      value={currentZone.smallOrderThreshold}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/10 focus:border-[#FF5C00] transition-all text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">Handling Surcharge (₹)</label>
                    <input 
                      required
                      type="number"
                      name="smallOrderFee"
                      value={currentZone.smallOrderFee}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/10 focus:border-[#FF5C00] transition-all text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: PLATFORM FEES & GST */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5">4. Dynamic Taxes & Platform Fees</h4>
                <div className="grid grid-cols-2 gap-6">
                  {/* GST */}
                  <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-black text-slate-700 uppercase">GST Service Tax</span>
                      <input 
                        type="checkbox" 
                        name="gstActive"
                        checked={currentZone.gstActive}
                        onChange={handleInputChange}
                        className="accent-[#FF5C00]"
                      />
                    </div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">GST Tax Percentage (%)</label>
                    <input 
                      required
                      type="number"
                      name="gstPercentage"
                      value={currentZone.gstPercentage}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs font-bold"
                    />
                  </div>

                  {/* Platform */}
                  <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-black text-slate-700 uppercase">Platform Fee</span>
                      <input 
                        type="checkbox" 
                        name="platformFeeActive"
                        checked={currentZone.platformFeeActive}
                        onChange={handleInputChange}
                        className="accent-[#FF5C00]"
                      />
                    </div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Flat platform charge (₹)</label>
                    <input 
                      required
                      type="number"
                      name="platformFee"
                      value={currentZone.platformFee}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs font-bold"
                    />
                  </div>

                  {/* Packaging */}
                  <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-black text-slate-700 uppercase">Packaging Charge</span>
                      <input 
                        type="checkbox" 
                        name="packagingChargeActive"
                        checked={currentZone.packagingChargeActive}
                        onChange={handleInputChange}
                        className="accent-[#FF5C00]"
                      />
                    </div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Flat packaging cost (₹)</label>
                    <input 
                      required
                      type="number"
                      name="packagingCharge"
                      value={currentZone.packagingCharge}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs font-bold"
                    />
                  </div>

                  {/* Convenience */}
                  <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-black text-slate-700 uppercase">Convenience Charge</span>
                      <input 
                        type="checkbox" 
                        name="convenienceFeeActive"
                        checked={currentZone.convenienceFeeActive}
                        onChange={handleInputChange}
                        className="accent-[#FF5C00]"
                      />
                    </div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Flat handling cost (₹)</label>
                    <input 
                      required
                      type="number"
                      name="convenienceFee"
                      value={currentZone.convenienceFee}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 5: SURGE PRICING */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">5. Surge pricing config</h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      name="surgeActive"
                      checked={currentZone.surgeActive}
                      onChange={handleInputChange}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FF5C00]"></div>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">Surge Multiplier</label>
                    <input 
                      required
                      type="number"
                      step="0.1"
                      name="surgeMultiplier"
                      value={currentZone.surgeMultiplier}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/10 focus:border-[#FF5C00] transition-all text-xs font-semibold"
                    />
                    <p className="text-[10px] text-slate-400 mt-1 ml-1">Multiplier on delivery fee (e.g. 1.5x)</p>
                  </div>
                </div>
              </div>
            </form>

            {/* Modal Actions Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
              {currentZone._id ? (
                <button
                  type="button"
                  onClick={() => handleDeleteZone(currentZone._id!)}
                  className="py-3.5 px-5 border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-sm active:scale-95"
                >
                  Delete Zone
                </button>
              ) : (
                <div className="w-10"></div>
              )}
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-3.5 px-5 bg-slate-200 hover:bg-slate-350 text-slate-700 text-xs font-black uppercase tracking-wider rounded-2xl transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="py-3.5 px-6 bg-[#FF5C00] hover:bg-[#e05200] text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-[#FF5C00]/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      Save Settings
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
