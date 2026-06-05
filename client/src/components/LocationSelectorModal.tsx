'use client';
import React, { useState, useEffect } from 'react';
import { useLocation } from '@/context/LocationContext';
import { apiClient } from '@/services/api';

interface LocationSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LocationSelectorModal({ isOpen, onClose }: LocationSelectorModalProps) {
  const {
    location,
    address,
    savedAddresses,
    selectedAddressId,
    isLoading: locationLoading,
    error: locationError,
    fetchLocation,
    setSelectedAddress
  } = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Debounced Places Autocomplete Query
  useEffect(() => {
    if (searchQuery.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await apiClient.get(`/locations/autocomplete?input=${encodeURIComponent(searchQuery)}`);
        if (res.data.success) {
          setSuggestions(res.data.suggestions || []);
        }
      } catch (err) {
        console.error("Autocomplete search failed:", err);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  if (!isOpen) return null;

  // Handle autocomplete suggestion click and resolve place details
  const handleSelectSuggestion = async (placeId: string) => {
    try {
      setSearching(true);
      setAddressError(null);
      const res = await apiClient.get(`/locations/place-details?placeId=${placeId}`);
      
      if (res.data.success) {
        const { fullAddress, lat, lng, pincode, city, state } = res.data.details;
        
        // Resolve delivery zone feasibility dynamically
        let zoneId = undefined;
        try {
          const feasibilityRes = await apiClient.post("/delivery-zones/check-feasibility", {
            userLat: lat,
            userLng: lng,
            pincode: pincode || ""
          });
          if (feasibilityRes.data.success) {
            zoneId = feasibilityRes.data.zoneId;
          }
        } catch (zErr) {
          setAddressError("This location lies outside our operational geofence limits.");
        }

        // Apply a guest-level saved address representation to LocationContext
        const formattedAddress: any = {
          _id: "guest-manual-coords",
          label: "Other",
          fullAddress,
          pincode: pincode || "000000",
          city: city || "Unknown",
          state: state || "Unknown",
          location: { lat, lng },
          deliveryZone: zoneId,
          isDefault: false
        };

        setSelectedAddress(formattedAddress);
        setSearchQuery('');
        setSuggestions([]);
        if (!zoneId) {
          // If out of radius, let user know but still close modal so they see warning banners
          alert("Selected address lies outside our delivery limits. You won't be able to checkout.");
        }
        onClose();
      }
    } catch (err: any) {
      console.error("Failed to select place suggestion:", err);
      setAddressError("Unable to load details for the selected address.");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSavedAddress = (addr: any) => {
    setSelectedAddress(addr);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[99999] flex items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-[512px] max-w-full h-full sm:h-[85vh] sm:rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-bottom duration-300">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Choose delivery location</h3>
            <p className="text-xs text-slate-500 mt-0.5">Select a saved address or search manually</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Autocomplete Input Search */}
          <div className="relative">
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Search Address</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined text-slate-400 absolute left-4 text-[20px]">search</span>
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type your area, building name or town..."
                className="w-full pl-11 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/10 focus:border-[#FF5C00] transition-all text-xs font-semibold text-slate-900 dark:text-white"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[16px]">cancel</span>
                </button>
              )}
            </div>

            {/* Error alerts */}
            {(addressError || locationError) && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-xl px-4 py-2.5 mt-3 text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-rose-500">warning</span>
                <span>{addressError || locationError}</span>
              </div>
            )}

            {/* suggestions list */}
            {searching && (
              <div className="absolute top-[100%] left-0 w-full bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl mt-2 p-3 text-center text-xs text-slate-400 shadow-xl z-50 flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-350 border-t-[#FF5C00] rounded-full animate-spin"></span>
                <span>Loading predictions...</span>
              </div>
            )}

            {!searching && suggestions.length > 0 && (
              <div className="absolute top-[100%] left-0 w-full bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl mt-2 shadow-2xl z-50 overflow-hidden max-h-[300px] overflow-y-auto">
                {suggestions.map((s) => (
                  <button
                    key={s.place_id}
                    onClick={() => handleSelectSuggestion(s.place_id)}
                    className="w-full text-left px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 flex items-start gap-3 border-b border-slate-50 dark:border-slate-900 transition-colors"
                  >
                    <span className="material-symbols-outlined text-slate-400 mt-0.5 shrink-0 text-[18px]">location_on</span>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-snug">{s.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* GPS Auto-Detect Button */}
          <button
            onClick={fetchLocation}
            disabled={locationLoading}
            className="w-full py-4 bg-[#FF5C00]/10 hover:bg-[#FF5C00]/15 rounded-2xl text-[#FF5C00] text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {locationLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-orange-200 border-t-[#FF5C00] rounded-full animate-spin"></span>
                <span>Acquiring GPS Signal...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">my_location</span>
                <span>Use Current GPS Location</span>
              </>
            )}
          </button>

          {/* Saved Addresses List */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Saved Addresses</h4>
            {savedAddresses.length === 0 ? (
              <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl p-6 text-center text-xs text-slate-400 font-semibold border border-slate-100 dark:border-slate-800">
                No saved address books found. Add one in the Saved Addresses page to speed up checkout.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {savedAddresses.map((addr) => {
                  const isSelected = selectedAddressId === addr._id;
                  let icon = 'home';
                  if (addr.label === 'Work') icon = 'work';
                  if (addr.label === 'Other') icon = 'home_work';

                  return (
                    <div 
                      key={addr._id}
                      onClick={() => handleSelectSavedAddress(addr)}
                      className={`p-4 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex justify-between items-start ${
                        isSelected 
                          ? 'border-[#FF5C00] ring-1 ring-[#FF5C00]/15' 
                          : 'border-slate-100 dark:border-slate-800 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-[#FF5C00]/10 text-[#FF5C00]' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          <span className="material-symbols-outlined text-[18px]">{icon}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[14px] text-slate-800 dark:text-white leading-none">{addr.label}</span>
                            {addr.isDefault && (
                              <span className="px-1.5 py-0.5 bg-emerald-55 text-emerald-700 text-[8px] font-black uppercase tracking-wider rounded">Default</span>
                            )}
                          </div>
                          <p className="text-[12px] text-slate-500 mt-1.5 leading-snug line-clamp-2 pr-4">{addr.fullAddress}</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-[#FF5C00]' : 'border-slate-300'
                      }`}>
                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#FF5C00]"></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {location && (
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex flex-col justify-center items-center shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">ACTIVE COURIER BOUNDS</span>
            <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 text-center truncate max-w-full leading-none">
              {address}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
