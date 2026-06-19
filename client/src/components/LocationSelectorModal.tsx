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
    fetchLocation,
    setSelectedAddress,
    loadSavedAddresses
  } = useLocation();

  const [step, setStep] = useState<'select' | 'form'>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [savingForm, setSavingForm] = useState(false);

  // Selected coordinates & zone
  const [tempCoords, setTempCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [tempZoneId, setTempZoneId] = useState<string | null>(null);

  // Form Fields
  const [houseNumber, setHouseNumber] = useState('');
  const [street, setStreet] = useState('');
  const [locality, setLocality] = useState('');
  const [village, setVillage] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const [instructions, setInstructions] = useState('');
  const [addressLabel, setAddressLabel] = useState<'Home' | 'Work' | 'Other'>('Home');

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

  // Handle Current Geolocation GPS Signal Check
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setAddressError("Geolocation is not supported by your browser");
      return;
    }

    setGpsLoading(true);
    setAddressError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Check feasibility with coordinates first
          const feasibilityRes = await apiClient.post("/delivery-zones/check-feasibility", {
            userLat: latitude,
            userLng: longitude
          });

          if (!feasibilityRes.data.success) {
            setAddressError("This location lies outside our operational service geofence bounds.");
            setGpsLoading(false);
            return;
          }

          const zoneId = feasibilityRes.data.zoneId;

          // Prefill reverse-geocoded address fields
          let prefillPincode = '';
          let prefillVillage = '';
          let prefillLocality = '';

          try {
            const geocodeRes = await apiClient.get(`/locations/reverse-geocode?lat=${latitude}&lng=${longitude}`);
            if (geocodeRes.data.success) {
              const details = geocodeRes.data.details;
              prefillPincode = details.pincode || '';
              prefillVillage = details.city || '';
              prefillLocality = details.fullAddress?.split(',')[0] || '';
            }
          } catch (err) {
            console.warn("Reverse geocode failed, prefilling empty fields.");
          }

          setTempCoords({ lat: latitude, lng: longitude });
          setTempZoneId(zoneId);
          setHouseNumber('');
          setStreet('');
          setLocality(prefillLocality);
          setVillage(prefillVillage);
          setLandmark('');
          setPincode(prefillPincode);
          setInstructions('');
          setStep('form');
        } catch (err: any) {
          console.error("Zone check failed:", err);
          setAddressError(err.response?.data?.message || "Sorry, you are currently outside our delivery service area.");
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        console.error("GPS error:", err);
        setAddressError("GPS coordinates access permission was denied");
        setGpsLoading(false);
      }
    );
  };

  // Handle autocomplete suggestion click and resolve place details
  const handleSelectSuggestion = async (placeId: string) => {
    try {
      setSearching(true);
      setAddressError(null);
      const res = await apiClient.get(`/locations/place-details?placeId=${placeId}`);
      
      if (res.data.success) {
        const { fullAddress, lat, lng, pincode, city } = res.data.details;
        
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

        if (!zoneId) {
          alert("Selected address lies outside our delivery limits. You won't be able to checkout.");
          return;
        }

        setTempCoords({ lat, lng });
        setTempZoneId(zoneId);
        setHouseNumber('');
        setStreet('');
        setLocality(fullAddress?.split(',')[0] || '');
        setVillage(city || '');
        setLandmark('');
        setPincode(pincode || '');
        setInstructions('');
        setStep('form');
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

  const handleSaveAddressForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempCoords || !tempZoneId) return;

    if (!houseNumber.trim()) {
      alert("House Number / Name is required");
      return;
    }
    if (!locality.trim()) {
      alert("Area / Locality is required");
      return;
    }
    if (!village.trim()) {
      alert("Village / City is required");
      return;
    }
    if (!landmark.trim()) {
      alert("Landmark is required");
      return;
    }

    const fullAddress = [
      houseNumber.trim() ? `House/Flat No: ${houseNumber.trim()}` : "",
      street.trim() ? `Road: ${street.trim()}` : "",
      locality.trim() ? `${locality.trim()}` : "",
      village.trim() ? `Village: ${village.trim()}` : "",
      landmark.trim() ? `Near: ${landmark.trim()}` : ""
    ].filter(Boolean).join(", ");

    const payload = {
      label: addressLabel,
      location: tempCoords,
      deliveryAddress: {
        houseNumber: houseNumber.trim(),
        street: street.trim(),
        locality: locality.trim(),
        village: village.trim(),
        landmark: landmark.trim(),
        pincode: pincode.trim(),
        instructions: instructions.trim()
      },
      isDefault: false
    };

    const token = localStorage.getItem('token');
    if (token) {
      try {
        setSavingForm(true);
        const res = await apiClient.post("/addresses", payload);
        if (res.data.success) {
          await loadSavedAddresses();
          setSelectedAddress(res.data.address);
          onClose();
        }
      } catch (err: any) {
        console.error("Failed to save address:", err);
        alert(err.response?.data?.message || "Failed to save address details.");
      } finally {
        setSavingForm(false);
      }
    } else {
      // Guest flow
      const formattedAddress: any = {
        _id: "guest-manual-coords",
        label: addressLabel,
        location: tempCoords,
        deliveryAddress: payload.deliveryAddress,
        fullAddress,
        pincode: pincode || "000000",
        city: village || "Unknown",
        state: "Punjab",
        deliveryZone: tempZoneId,
        isDefault: false
      };
      setSelectedAddress(formattedAddress);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[99999] flex items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-[512px] max-w-full h-full sm:h-[90vh] sm:rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-bottom duration-300">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {step === 'select' ? 'Choose delivery location' : 'Enter Delivery Details'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {step === 'select' ? 'Select a saved address or search manually' : 'Provide manual details for accurate delivery'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Body */}
        {step === 'select' ? (
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
              {(addressError) && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-xl px-4 py-2.5 mt-3 text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-rose-500">warning</span>
                  <span>{addressError}</span>
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
              onClick={handleDetectGPS}
              disabled={gpsLoading}
              className="w-full py-4 bg-[#FF5C00]/10 hover:bg-[#FF5C00]/15 rounded-2xl text-[#FF5C00] text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {gpsLoading ? (
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
        ) : (
          <form onSubmit={handleSaveAddressForm} className="flex-1 overflow-y-auto p-6 space-y-4">
            
            {/* House / Flat No */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">House Number / House Name *</label>
              <input
                type="text"
                required
                value={houseNumber}
                onChange={(e) => setHouseNumber(e.target.value)}
                placeholder="e.g. House No. 152 / Ground Floor"
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-[#FF5C00] text-xs font-semibold"
              />
            </div>

            {/* Street / Gali (Optional) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Street / Gali (Optional)</label>
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="e.g. Gali No. 3 / Main Chowk Road"
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-[#FF5C00] text-xs font-semibold"
              />
            </div>

            {/* Locality */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Area / Locality *</label>
              <input
                type="text"
                required
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                placeholder="e.g. Main Market / Sector 4"
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-[#FF5C00] text-xs font-semibold"
              />
            </div>

            {/* Village / City */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Village / City *</label>
              <input
                type="text"
                required
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder="e.g. Rampur Village / Amritsar"
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-[#FF5C00] text-xs font-semibold"
              />
            </div>

            {/* Landmark */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block font-bold text-orange-650">Nearby Landmark *</label>
              <input
                type="text"
                required
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g. Near Government School / Beside Hanuman Temple"
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-[#FF5C00]/30 dark:border-slate-700 rounded-2xl outline-none focus:border-[#FF5C00] text-xs font-black text-slate-900 dark:text-white"
              />
            </div>

            {/* Pincode (Optional) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Pincode (Optional)</label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 147001"
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-[#FF5C00] text-xs font-semibold"
              />
            </div>

            {/* Instructions (Optional) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Delivery Instructions (Optional)</label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Ring bell / Leave at gate / Call when outside"
                rows={2}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-[#FF5C00] text-xs font-semibold resize-none"
              />
            </div>

            {/* Address Tag Selection */}
            <div className="space-y-2 pt-2">
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">Save Address As</label>
              <div className="grid grid-cols-3 gap-3">
                {(['Home', 'Work', 'Other'] as const).map((label) => (
                  <button
                    type="button"
                    key={label}
                    onClick={() => setAddressLabel(label)}
                    className={`py-3 rounded-2xl text-xs font-black uppercase tracking-wider border transition-all ${
                      addressLabel === label 
                        ? 'bg-[#FF5C00] border-[#FF5C00] text-white shadow-md' 
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 shrink-0">
              <button
                type="button"
                onClick={() => setStep('select')}
                className="flex-1 py-4 border-2 border-slate-200 rounded-2xl text-slate-600 text-xs font-black uppercase tracking-wider"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={savingForm || !houseNumber.trim() || !locality.trim() || !village.trim() || !landmark.trim()}
                className="flex-1 py-4 bg-[#FF5C00] hover:bg-[#e05200] text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {savingForm ? 'Saving Address...' : 'Confirm Address'}
              </button>
            </div>

          </form>
        )}

        {/* Footer */}
        {step === 'select' && location && (
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

