"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/services/api";

interface PlatformSettings {
  isPlatformOpen: boolean;
  maintenanceMode: boolean;
  operatingHours: {
    open: string;
    close: string;
  };
  groceryStatus: "open" | "closed" | "disabled";
}

interface Restaurant {
  _id: string;
  name: string;
  ownerName: string;
  phone: string;
  cuisines: string;
  availabilityStatus: "open" | "closed" | "disabled";
  status: string;
  isBlocked: boolean;
}

export default function PlatformManagementPage() {
  const [settings, setSettings] = useState<PlatformSettings>({
    isPlatformOpen: true,
    maintenanceMode: false,
    operatingHours: { open: "08:00", close: "22:00" },
    groceryStatus: "open"
  });

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3005);
  };

  const fetchSettings = async () => {
    try {
      setLoadingSettings(true);
      const res = await apiClient.get("/platform/settings");
      if (res.data.success && res.data.settings) {
        setSettings(res.data.settings);
      }
    } catch (err: any) {
      console.error("Failed to fetch settings:", err);
      showToast(err.response?.data?.message || "Failed to load platform settings.", "error");
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchRestaurants = async () => {
    try {
      setLoadingRestaurants(true);
      const res = await apiClient.get("/restaurants?status=approved");
      if (res.data.success) {
        setRestaurants(res.data.restaurants || []);
      }
    } catch (err: any) {
      console.error("Failed to fetch restaurants:", err);
      showToast("Failed to load restaurants list.", "error");
    } finally {
      setLoadingRestaurants(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchRestaurants();
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await apiClient.patch("/platform/settings", {
        operatingHours: settings.operatingHours
      });
      if (res.data.success) {
        showToast("Platform configuration updated successfully!");
      }
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      showToast(err.response?.data?.message || "Failed to save settings.", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTogglePlatformOpen = async (newVal: boolean) => {
    try {
      setSettings(prev => ({ ...prev, isPlatformOpen: newVal }));
      const res = await apiClient.patch("/platform/settings", { isPlatformOpen: newVal });
      if (res.data.success) {
        showToast(`Platform ordering is now ${newVal ? 'OPEN' : 'CLOSED'}!`);
      }
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      showToast(err.response?.data?.message || "Failed to update platform status.", "error");
    }
  };

  const handleToggleMaintenanceMode = async (newVal: boolean) => {
    try {
      setSettings(prev => ({ ...prev, maintenanceMode: newVal }));
      const res = await apiClient.patch("/platform/settings", { maintenanceMode: newVal });
      if (res.data.success) {
        showToast(`Maintenance mode is now ${newVal ? 'ON' : 'OFF'}!`);
      }
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      showToast(err.response?.data?.message || "Failed to update maintenance mode.", "error");
    }
  };

  const handleUpdateGroceryStatus = async (status: "open" | "closed" | "disabled") => {
    try {
      setSettings(prev => ({ ...prev, groceryStatus: status }));
      const res = await apiClient.patch("/platform/settings", { groceryStatus: status });
      if (res.data.success) {
        showToast(`Grocery availability updated to ${status}!`);
      }
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      showToast(err.response?.data?.message || "Failed to update grocery status.", "error");
    }
  };

  const handleRestaurantAvailability = async (restaurantId: string, status: "open" | "closed" | "disabled") => {
    try {
      const res = await apiClient.patch(`/admin/restaurants/${restaurantId}/availability`, {
        availabilityStatus: status
      });
      if (res.data.success) {
        setRestaurants(restaurants.map(r => r._id === restaurantId ? { ...r, availabilityStatus: status } : r));
        showToast(`Restaurant availability updated to ${status}`);
      }
    } catch (err: any) {
      console.error("Failed to update restaurant availability:", err);
      showToast(err.response?.data?.message || "Failed to update restaurant status.", "error");
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8 bg-slate-50/30 flex flex-col min-w-0 font-sans">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[999] px-6 py-3.5 rounded-2xl text-white font-bold text-xs shadow-xl animate-in fade-in slide-in-from-top-4 ${
          toast.type === "success" ? "bg-emerald-650 shadow-emerald-100" : "bg-rose-650 shadow-rose-100"
        }`} style={{ backgroundColor: toast.type === "success" ? "#10B981" : "#EF4444" }}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">
              {toast.type === "success" ? "check_circle" : "error"}
            </span>
            {toast.message}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-[28px] font-black text-slate-800 tracking-tight leading-none mb-3">Platform Management</h2>
          <p className="text-[13px] font-semibold text-slate-400 uppercase tracking-widest leading-none mt-2">
            Operational overrides, Maintenance banners, Operating hours, and Store controls
          </p>
        </div>
        <button 
          onClick={() => { fetchSettings(); fetchRestaurants(); }}
          className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[13px] font-bold hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Refresh Live States
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        
        {/* Left 2 Columns: Configuration Panels */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Global platform toggles */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FF5C00] text-[24px]">settings_suggest</span>
              Global Operations
            </h3>

            {loadingSettings ? (
              <div className="py-12 text-center text-slate-400 text-xs font-bold">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-2"></div>
                Loading settings...
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Platform Open Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-2xl">
                  <div className="space-y-1 pr-4">
                    <p className="text-[14px] font-black text-slate-800">Global Ordering Status</p>
                    <p className="text-xs font-medium text-slate-400 max-w-md">
                      Open or close ordering services platform-wide. When closed, checkout and payments will be disabled.
                    </p>
                  </div>
                  <button
                    onClick={() => handleTogglePlatformOpen(!settings.isPlatformOpen)}
                    className={`w-14 h-8 rounded-full p-1 transition-colors relative flex items-center shrink-0 cursor-pointer ${
                      settings.isPlatformOpen ? "bg-[#FF5C00]" : "bg-slate-200"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
                      settings.isPlatformOpen ? "translate-x-6" : "translate-x-0"
                    }`} />
                  </button>
                </div>

                {/* Maintenance Mode Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-2xl">
                  <div className="space-y-1 pr-4">
                    <p className="text-[14px] font-black text-slate-800">Maintenance Mode</p>
                    <p className="text-xs font-medium text-slate-400 max-w-md">
                      Puts the platform in maintenance mode. Shows a warning banner to all users and disables payments and ordering.
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleMaintenanceMode(!settings.maintenanceMode)}
                    className={`w-14 h-8 rounded-full p-1 transition-colors relative flex items-center shrink-0 cursor-pointer ${
                      settings.maintenanceMode ? "bg-[#FF5C00]" : "bg-slate-200"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
                      settings.maintenanceMode ? "translate-x-6" : "translate-x-0"
                    }`} />
                  </button>
                </div>

                {/* Grocery Operations Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl">
                  <div className="space-y-1 pr-4">
                    <p className="text-[14px] font-black text-slate-800">Grocery Operations Control</p>
                    <p className="text-xs font-medium text-slate-400 max-w-md">
                      Set grocery availability. "Disabled" temporarily suspends grocery ordering.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {(["open", "closed", "disabled"] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleUpdateGroceryStatus(status)}
                        className={`px-4 py-2 text-xs font-extrabold rounded-xl capitalize transition-all border shadow-sm cursor-pointer ${
                          settings.groceryStatus === status
                            ? "bg-[#FF5C00] border-[#FF5C00] text-white"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Operating hours settings */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FF5C00] text-[24px]">schedule</span>
              Operating Hours Control
            </h3>

            {loadingSettings ? (
              <div className="py-12 text-center text-slate-400 text-xs font-bold">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-2"></div>
                Loading settings...
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Configure daily operational window (India Standard Time)
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">Open Time (e.g. 08:00)</label>
                    <input
                      type="time"
                      value={settings.operatingHours.open}
                      onChange={(e) => setSettings({
                        ...settings,
                        operatingHours: { ...settings.operatingHours, open: e.target.value }
                      })}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-[14px] font-bold text-slate-805 focus:outline-none focus:border-[#FF5C00] transition-colors shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">Close Time (e.g. 22:00)</label>
                    <input
                      type="time"
                      value={settings.operatingHours.close}
                      onChange={(e) => setSettings({
                        ...settings,
                        operatingHours: { ...settings.operatingHours, close: e.target.value }
                      })}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-[14px] font-bold text-slate-805 focus:outline-none focus:border-[#FF5C00] transition-colors shadow-sm"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="w-full sm:w-auto px-6 py-3.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white rounded-2xl font-black text-xs shadow-md shadow-slate-100 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    {savingSettings ? "Saving configuration..." : "Save Platform Configuration"}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right 1 Column: System Overview Metric cards */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm flex flex-col gap-6">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest leading-none border-b border-slate-100 pb-4">
              Real-time Overview
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Platform status</span>
                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                  settings.isPlatformOpen ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                }`}>
                  {settings.isPlatformOpen ? "Open" : "Closed"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Maintenance Mode</span>
                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                  settings.maintenanceMode ? "bg-rose-50 text-rose-700 animate-pulse" : "bg-slate-100 text-slate-600"
                }`}>
                  {settings.maintenanceMode ? "ACTIVE" : "OFF"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Grocery Operations</span>
                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                  settings.groceryStatus === "open"
                    ? "bg-emerald-50 text-emerald-700"
                    : settings.groceryStatus === "disabled"
                    ? "bg-rose-50 text-rose-700"
                    : "bg-amber-50 text-amber-700"
                }`}>
                  {settings.groceryStatus}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Operating window</span>
                <span className="text-xs font-black text-slate-805">
                  {settings.operatingHours.open} - {settings.operatingHours.close}
                </span>
              </div>
            </div>
          </div>
          
          <div className="bg-[#FFF8F5] border border-[#FFE2D6]/70 rounded-3xl p-6">
            <h4 className="text-[13px] font-black text-[#5A2000] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">info</span>
              Operations Note
            </h4>
            <p className="text-xs font-medium text-[#7D3F1E] leading-relaxed">
              Disabling ordering or enabling maintenance takes effect immediately. The checkout page, payments module, and restaurant/grocery detail pages update in real-time for all active users without page reload.
            </p>
          </div>
        </div>

      </div>

      {/* Main Table: Restaurant availability status management */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden mb-8">
        
        {/* Table Title */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/20">
          <div>
            <h3 className="text-lg font-black text-slate-800">Restaurant Availability Management</h3>
            <p className="text-[11px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              Control the operational status of individual merchant outlets
            </p>
          </div>
          <span className="px-3.5 py-1 bg-slate-105 text-slate-600 text-[11px] font-bold rounded-full">
            {restaurants.length} Approved Outlets
          </span>
        </div>

        {/* Table list */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/10 border-b border-slate-100">
                <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Merchant Details</th>
                <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Contact Information</th>
                <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Cuisines / Menu</th>
                <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Platform Status</th>
                <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Operational Status Overrides</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingRestaurants ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400 font-semibold text-xs">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-3"></div>
                    Loading restaurant availability...
                  </td>
                </tr>
              ) : restaurants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400 font-bold text-xs">
                    <span className="material-symbols-outlined text-[40px] text-slate-200 block mb-2">storefront</span>
                    No approved restaurants to configure.
                  </td>
                </tr>
              ) : (
                restaurants.map((res) => (
                  <tr key={res._id} className="hover:bg-slate-50/30 transition-colors">
                    {/* Name */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/50 flex items-center justify-center text-slate-450 shrink-0">
                          <span className="material-symbols-outlined text-[20px]">storefront</span>
                        </div>
                        <div>
                          <h4 className="text-[13px] font-black text-slate-850 leading-snug">{res.name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Owner: {res.ownerName || "Partner"}</p>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="py-4 px-6">
                      <p className="text-[12px] font-bold text-slate-700">+91 {res.phone}</p>
                    </td>

                    {/* Cuisines */}
                    <td className="py-4 px-6">
                      <p className="text-[12px] font-bold text-slate-650 line-clamp-1">{res.cuisines}</p>
                    </td>

                    {/* Badge */}
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase ${
                        res.availabilityStatus === "open"
                          ? "bg-emerald-50 text-emerald-700"
                          : res.availabilityStatus === "disabled"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          res.availabilityStatus === "open"
                            ? "bg-emerald-500"
                            : res.availabilityStatus === "disabled"
                            ? "bg-rose-500"
                            : "bg-amber-500"
                        }`}></span>
                        {res.availabilityStatus === "disabled" ? "Disabled" : res.availabilityStatus}
                      </span>
                    </td>

                    {/* Overrides */}
                    <td className="py-4 px-6">
                      <div className="flex justify-end gap-2">
                        {(["open", "closed", "disabled"] as const).map((status) => (
                          <button
                            key={status}
                            onClick={() => handleRestaurantAvailability(res._id, status)}
                            className={`px-3 py-1.5 text-[10px] font-black rounded-xl uppercase tracking-wider transition-all border cursor-pointer ${
                              res.availabilityStatus === status
                                ? status === "open"
                                  ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                                  : status === "closed"
                                  ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                                  : "bg-rose-600 border-rose-600 text-white shadow-sm"
                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                            }`}
                          >
                            {status === "disabled" ? "Disable" : status}
                          </button>
                        ))}
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
  );
}
