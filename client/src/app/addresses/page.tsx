'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocation } from '@/context/LocationContext';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/services/api';
import Header from '@/components/Header';
import BottomNavBar from '@/components/BottomNavBar';

interface AddressData {
  _id?: string;
  label: "Home" | "Work" | "Other";
  fullAddress: string;
  pincode: string;
  city: string;
  state: string;
  country?: string;
  location: {
    lat: number;
    lng: number;
  };
  isDefault: boolean;
  deliveryZone?: string;
  deliveryAddress?: {
    houseNumber: string;
    street?: string;
    locality: string;
    village: string;
    landmark: string;
    pincode?: string;
    instructions?: string;
  };
}

const emptyAddress: AddressData = {
  label: "Home",
  fullAddress: "",
  pincode: "",
  city: "",
  state: "",
  country: "India",
  location: { lat: 28.7041, lng: 77.1025 },
  isDefault: false
};

export default function AddressesPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { savedAddresses, selectedAddressId, loadSavedAddresses, setSelectedAddress } = useLocation();

  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentAddress, setCurrentAddress] = useState<AddressData>(emptyAddress);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      alert("Please log in to manage your saved addresses.");
      router.push("/auth/login");
      return;
    }
    
    const init = async () => {
      await loadSavedAddresses();
      setLoading(false);
    };
    init();
  }, [token]);

  // Debounced Places Autocomplete
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
        console.error("Autocomplete failed:", err);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const [houseNumber, setHouseNumber] = useState('');
  const [street, setStreet] = useState('');
  const [locality, setLocality] = useState('');
  const [village, setVillage] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincodeField, setPincodeField] = useState('');
  const [instructions, setInstructions] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

  const handleOpenCreate = () => {
    setCurrentAddress(emptyAddress);
    setSearchQuery('');
    setSuggestions([]);
    setValidationError(null);
    setHouseNumber('');
    setStreet('');
    setLocality('');
    setVillage('');
    setLandmark('');
    setPincodeField('');
    setInstructions('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (addr: AddressData) => {
    setCurrentAddress(addr);
    setSearchQuery(addr.fullAddress);
    setSuggestions([]);
    setValidationError(null);

    const da = addr.deliveryAddress;
    setHouseNumber(da?.houseNumber || '');
    setStreet(da?.street || '');
    setLocality(da?.locality || '');
    setVillage(da?.village || addr.city || '');
    setLandmark(da?.landmark || '');
    setPincodeField(da?.pincode || addr.pincode || '');
    setInstructions(da?.instructions || '');

    setIsModalOpen(true);
  };

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setValidationError("Geolocation is not supported by your browser");
      return;
    }

    setGpsLoading(true);
    setValidationError(null);

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
            setValidationError("This location lies outside our operational service geofence bounds.");
            setGpsLoading(false);
            return;
          }

          // Prefill reverse-geocoded address fields
          let prefillPincode = '';
          let prefillVillage = '';
          let prefillLocality = '';
          let fullAddress = 'GPS Coordinates';

          try {
            const geocodeRes = await apiClient.get(`/locations/reverse-geocode?lat=${latitude}&lng=${longitude}`);
            if (geocodeRes.data.success) {
              const details = geocodeRes.data.details;
              fullAddress = details.fullAddress || 'GPS Coordinates';
              prefillPincode = details.pincode || '';
              prefillVillage = details.city || '';
              prefillLocality = details.fullAddress?.split(',')[0] || '';
            }
          } catch (err) {
            console.warn("Reverse geocode failed, prefilling empty fields.");
          }

          setCurrentAddress(prev => ({
            ...prev,
            fullAddress,
            location: { lat: latitude, lng: longitude }
          }));

          setLocality(prefillLocality);
          setVillage(prefillVillage);
          setPincodeField(prefillPincode);
          setSearchQuery(fullAddress);
        } catch (err: any) {
          console.error("Zone check failed:", err);
          setValidationError(err.response?.data?.message || "Sorry, you are currently outside our delivery service area.");
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        console.error("GPS error:", err);
        setValidationError("GPS coordinates access permission was denied");
        setGpsLoading(false);
      }
    );
  };

  const handleSelectSuggestion = async (placeId: string) => {
    try {
      setSearching(true);
      setValidationError(null);
      const res = await apiClient.get(`/locations/place-details?placeId=${placeId}`);
      if (res.data.success) {
        const { fullAddress, lat, lng, pincode, city, state, country } = res.data.details;
        
        setCurrentAddress(prev => ({
          ...prev,
          fullAddress,
          pincode: pincode || "",
          city: city || "",
          state: state || "",
          country: country || "India",
          location: { lat, lng }
        }));
        
        setLocality(fullAddress?.split(',')[0] || '');
        setVillage(city || '');
        setPincodeField(pincode || '');
        setSearchQuery(fullAddress);
        setSuggestions([]);

        // Validate operational geofence boundaries
        try {
          const feasibilityRes = await apiClient.post("/delivery-zones/check-feasibility", {
            userLat: lat,
            userLng: lng,
            pincode: pincode || ""
          });
          if (!feasibilityRes.data.success) {
            setValidationError("This location lies outside our operational service geofence bounds.");
          }
        } catch (zErr) {
          setValidationError("This location lies outside our operational service geofence bounds.");
        }
      }
    } catch (err) {
      console.error("Failed to load details for suggestion:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleToggleDefault = async (addrId: string) => {
    try {
      const res = await apiClient.patch(`/addresses/${addrId}/default`);
      if (res.data.success) {
        await loadSavedAddresses();
        setSelectedAddress(res.data.address);
      }
    } catch (err) {
      console.error("Failed to set default address:", err);
      alert("Failed to update default address.");
    }
  };

  const handleDeleteAddress = async (addrId: string) => {
    if (!confirm("Are you sure you want to remove this saved address?")) return;
    try {
      const res = await apiClient.delete(`/addresses/${addrId}`);
      if (res.data.success) {
        await loadSavedAddresses();
        if (selectedAddressId === addrId) {
          setSelectedAddress(null);
        }
        alert("Address removed successfully!");
      }
    } catch (err) {
      console.error("Failed to remove address:", err);
      alert("Failed to delete address.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAddress.location || currentAddress.location.lat === undefined) {
      alert("Please select a location using GPS or search autocomplete prediction first.");
      return;
    }

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

    setSaving(true);
    try {
      const payload = {
        label: currentAddress.label,
        location: currentAddress.location,
        deliveryAddress: {
          houseNumber: houseNumber.trim(),
          street: street.trim(),
          locality: locality.trim(),
          village: village.trim(),
          landmark: landmark.trim(),
          pincode: pincodeField.trim(),
          instructions: instructions.trim()
        },
        isDefault: currentAddress.isDefault
      };

      let res;
      if (currentAddress._id) {
        res = await apiClient.put(`/addresses/${currentAddress._id}`, payload);
      } else {
        res = await apiClient.post("/addresses", payload);
      }

      if (res.data.success) {
        await loadSavedAddresses();
        // If first address saved or marked default, select it in context
        if (savedAddresses.length === 0 || currentAddress.isDefault) {
          setSelectedAddress(res.data.address);
        }
        alert(currentAddress._id ? "Address updated successfully!" : "Address saved successfully!");
        setIsModalOpen(false);
      }
    } catch (err: any) {
      console.error("Failed to save address:", err);
      alert(err.response?.data?.message || "Failed to save address. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#fcfcfc] gap-3">
        <span className="material-symbols-outlined text-[40px] text-[#FF5C00] animate-spin">sync</span>
        <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Loading address book...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#fcfcfc] min-h-screen pb-28 text-slate-900 w-full font-sans">
      <Header />
      
      <main className="mt-20 max-w-2xl mx-auto px-4 sm:px-6 space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
          <div>
            <p className="text-[10px] font-black tracking-widest text-[#FF5C00] uppercase mb-1">COURIER PREFERENCES</p>
            <h2 className="text-[26px] font-bold text-slate-900 tracking-tight leading-none">Saved Addresses</h2>
          </div>
          <button 
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-[#FF5C00] hover:bg-[#e05200] px-4 py-3 rounded-2xl text-xs font-black text-white uppercase tracking-wider shadow-md transition-all active:scale-95 shrink-0 w-full sm:w-auto justify-center"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add Address
          </button>
        </div>


        {/* Address Cards List */}
        {savedAddresses.length === 0 ? (
          <div 
            style={{ width: "100%", maxWidth: "576px" }}
            className="bg-white rounded-3xl p-6 sm:p-10 flex flex-col items-center justify-center text-center py-12 sm:py-20 border border-slate-100 shadow-sm mx-auto my-6 sm:my-12"
          >
            <span className="material-symbols-outlined text-[48px] text-slate-350 mb-4 animate-pulse">home_work</span>
            <h3 className="font-extrabold text-slate-700 text-[17px] leading-none">Your Address Book is empty</h3>
            <p className="text-slate-400 text-xs font-semibold max-w-[320px] mx-auto leading-relaxed mt-2.5 mb-8">
              Add your Home, Work, or Custom delivery locations to checkout in a single click next time.
            </p>
            <button 
              onClick={handleOpenCreate}
              className="px-6 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-800 transition-all shadow-md active:scale-95"
            >
              Add Your First Address
            </button>
          </div>

        ) : (
          <div className="grid grid-cols-1 gap-4">
            {savedAddresses.map((addr) => {
              const isSelected = selectedAddressId === addr._id;
              let icon = 'home';
              if (addr.label === 'Work') icon = 'work';
              if (addr.label === 'Other') icon = 'home_work';

              return (
                <div 
                  key={addr._id}
                  className={`bg-white rounded-3xl p-5 border shadow-sm flex flex-col sm:flex-row justify-between sm:items-start gap-4 transition-all ${
                    isSelected ? 'border-[#FF5C00] ring-1 ring-[#FF5C00]/10' : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-[#FF5C00]/10 text-[#FF5C00]' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <span className="material-symbols-outlined text-[20px]">{icon}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-900 text-base leading-none">{addr.label}</span>
                        {addr.isDefault && (
                          <span className="px-2 py-0.5 bg-emerald-55 text-emerald-700 text-[8px] font-black uppercase tracking-wider rounded">Default</span>
                        )}
                        {!addr.deliveryZone && (
                          <span className="px-2 py-0.5 bg-rose-55 text-rose-700 text-[8px] font-black uppercase tracking-wider rounded">Outside Zone</span>
                        )}
                      </div>
                      <p className="text-[13px] text-slate-500 font-medium leading-relaxed mt-2 pr-4">{addr.fullAddress}</p>
                      
                      <div className="flex gap-4 items-center mt-4">
                        {!addr.isDefault && (
                          <button 
                            onClick={() => handleToggleDefault(addr._id!)}
                            className="text-[#FF5C00] text-xs font-bold hover:underline"
                          >
                            Set Default
                          </button>
                        )}
                        {isSelected ? (
                          <span className="text-slate-400 text-xs font-bold flex items-center gap-1 leading-none select-none">
                            <span className="material-symbols-outlined text-[14px] text-emerald-500">check_circle</span>
                            Selected
                          </span>
                        ) : (
                          addr.deliveryZone && (
                            <button 
                              onClick={() => setSelectedAddress(addr)}
                              className="text-slate-600 text-xs font-bold hover:underline"
                            >
                              Deliver Here
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t sm:border-t-0 border-slate-50 pt-3 sm:pt-0 flex sm:flex-col gap-2 shrink-0 self-end sm:self-auto">
                    <button
                      onClick={() => handleOpenEdit(addr)}
                      className="flex-1 sm:flex-initial px-4 py-2 border border-slate-100 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteAddress(addr._id!)}
                      className="flex-1 sm:flex-initial px-4 py-2 border border-rose-100 hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      <BottomNavBar />

      {/* CREATE / EDIT SLIDE-OVER FORM MODAL */}
      {isModalOpen && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            zIndex: 99999,
          }}
          className="flex items-center justify-end p-0 md:p-4 backdrop-blur-sm"
        >
          <div 
            style={{ width: "100%", maxWidth: "512px", height: "100%" }}
            className="bg-white md:h-[90vh] md:rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden"
          >
            
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {currentAddress._id ? "Edit Saved Address" : "Add New Delivery Address"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Enter location details and tag labeling</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Form Scroll Area */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* Autocomplete Places Search */}
              <div className="relative space-y-2">
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">Search Street/Area</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined text-slate-400 absolute left-4 text-[20px]">search</span>
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type area name, building, street..."
                    className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/10 focus:border-[#FF5C00] transition-all text-xs font-semibold"
                  />
                  {searchQuery && (
                    <button 
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-4 text-slate-400 hover:text-slate-650"
                    >
                      <span className="material-symbols-outlined text-[16px]">cancel</span>
                    </button>
                  )}
                </div>

                {searching && (
                  <div className="absolute top-[100%] left-0 w-full bg-white border border-slate-100 rounded-2xl mt-1 p-3 text-center text-xs text-slate-400 shadow-xl z-50 flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-slate-350 border-t-[#FF5C00] rounded-full animate-spin"></span>
                    <span>Fetching recommendations...</span>
                  </div>
                )}

                {suggestions.length > 0 && (
                  <div className="absolute top-[100%] left-0 w-full bg-white border border-slate-100 rounded-2xl mt-1 shadow-2xl z-50 overflow-hidden max-h-[220px] overflow-y-auto">
                    {suggestions.map((s) => (
                      <button
                        type="button"
                        key={s.place_id}
                        onClick={() => handleSelectSuggestion(s.place_id)}
                        className="w-full text-left px-5 py-3 hover:bg-slate-50 flex items-start gap-3 border-b border-slate-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-slate-400 mt-0.5 shrink-0 text-[18px]">location_on</span>
                        <span className="text-xs font-medium text-slate-700 leading-snug">{s.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* GPS Onboarding Button */}
              <button
                type="button"
                onClick={handleDetectGPS}
                disabled={gpsLoading}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-md font-bold text-xs uppercase tracking-wider disabled:opacity-50"
              >
                {gpsLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                    Detecting GPS Location...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">my_location</span>
                    Lock Current GPS Location
                  </>
                )}
              </button>

              {/* Validation Warnings */}
              {validationError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-xl px-3 py-2 text-[11px] font-semibold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-rose-500">warning</span>
                  <span>{validationError}</span>
                </div>
              )}

              {/* House Number */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">House Number / House Name *</label>
                <input
                  type="text"
                  required
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  placeholder="e.g. House No. 152 / Main Chowk"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-[#FF5C00] text-xs font-semibold text-slate-800"
                />
              </div>

              {/* Street / Gali */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Street / Gali (Optional)</label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="e.g. Gali No. 3 / Main Road"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-[#FF5C00] text-xs font-semibold text-slate-800"
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
                  placeholder="e.g. Main Chowk / Ward 5"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-[#FF5C00] text-xs font-semibold text-slate-800"
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
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-[#FF5C00] text-xs font-semibold text-slate-800"
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
                  placeholder="e.g. Near Government School"
                  className="w-full p-3 bg-slate-50 border border-[#FF5C00]/30 rounded-2xl outline-none focus:border-[#FF5C00] text-xs font-black text-slate-900"
                />
              </div>

              {/* Pincode */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Pincode (Optional)</label>
                <input
                  type="text"
                  value={pincodeField}
                  onChange={(e) => setPincodeField(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 147001"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-[#FF5C00] text-xs font-semibold text-slate-800"
                />
              </div>

              {/* Instructions */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Delivery Instructions (Optional)</label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. Ring bell / Leave at gate"
                  rows={2}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-[#FF5C00] text-xs font-semibold text-slate-850 resize-none"
                />
              </div>

              {/* Label Toggle Home / Work / Other */}
              <div className="space-y-2">
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">Address Label</label>
                <div className="grid grid-cols-3 gap-3">
                  {(["Home", "Work", "Other"] as const).map((l) => {
                    const isSelected = currentAddress.label === l;
                    let icon = 'home';
                    if (l === 'Work') icon = 'work';
                    if (l === 'Other') icon = 'home_work';

                    return (
                      <button
                        type="button"
                        key={l}
                        onClick={() => setCurrentAddress(prev => ({ ...prev, label: l }))}
                        className={`py-3 rounded-2xl text-xs font-black uppercase tracking-wider border transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                          isSelected 
                            ? 'bg-[#FF5C00] border-[#FF5C00] text-white shadow-md shadow-[#FF5C00]/25' 
                            : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">{icon}</span>
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Set default toggle switch */}
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Mark as primary default address</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Use this address automatically for checkouts</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={currentAddress.isDefault}
                    onChange={(e) => setCurrentAddress(prev => ({ ...prev, isDefault: e.target.checked }))}
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FF5C00]"></div>
                </label>
              </div>

            </form>

            {/* Actions Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="py-3.5 px-5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black uppercase tracking-wider rounded-2xl transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !currentAddress.location || !houseNumber.trim() || !locality.trim() || !village.trim() || !landmark.trim()}
                className="py-3.5 px-6 bg-[#FF5C00] hover:bg-[#e05200] text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-[#FF5C00]/25 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Saving Address...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Save Address
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
