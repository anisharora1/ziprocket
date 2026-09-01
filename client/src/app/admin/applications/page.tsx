"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { 
  MdVisibility, 
  MdClose, 
  MdInfo, 
  MdDescription, 
  MdAccountBalance, 
  MdPerson, 
  MdBadge,
  MdMap,
  MdOpenInNew,
  MdLocationOn,
  MdWarning,
  MdEditLocation,
  MdSearch,
  MdCancel,
  MdSave
} from "react-icons/md";

export default function ApplicationsPage() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"restaurants" | "deliveries">("restaurants");
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [selectedAppType, setSelectedAppType] = useState<"restaurant" | "delivery" | null>(null);

  // Set Location Modal State
  const [locationModalApp, setLocationModalApp] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [manualLat, setManualLat] = useState<number | string>("");
  const [manualLng, setManualLng] = useState<number | string>("");
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const { token } = useAuth();

  const fetchApplications = async () => {
    try {
      const res = await apiClient.get("/admin/applications/pending");
      if (res.data.success) {
        setRestaurants(res.data.applications?.restaurants || []);
        setDeliveries(res.data.applications?.deliveries || []);
      }
    } catch (error) {
      console.error("Failed to fetch applications", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [token]);

  // Debounced Places Autocomplete Query
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 3) {
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

  const handleOpenSetLocation = (app: any) => {
    setLocationModalApp(app);
    setSearchQuery("");
    setSuggestions([]);
    setLocationError(null);
    setManualAddress(app.location?.address || "");
    setManualLat(app.location?.lat && app.location.lat !== 0 ? app.location.lat : "");
    setManualLng(app.location?.lng && app.location.lng !== 0 ? app.location.lng : "");
  };

  const handleSelectSuggestion = async (placeId: string) => {
    try {
      setSearching(true);
      setLocationError(null);
      const res = await apiClient.get(`/locations/place-details?placeId=${placeId}`);
      if (res.data.success) {
        const { fullAddress, lat, lng } = res.data.details;
        setManualAddress(fullAddress || "");
        setManualLat(lat);
        setManualLng(lng);
        setSearchQuery(fullAddress || "");
        setSuggestions([]);
      }
    } catch (err) {
      console.error("Failed to select place suggestion:", err);
      setLocationError("Unable to load details for the selected address.");
    } finally {
      setSearching(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!locationModalApp) return;

    const latNum = Number(manualLat);
    const lngNum = Number(manualLng);

    if (!manualAddress.trim()) {
      setLocationError("Address is required.");
      return;
    }
    if (isNaN(latNum) || isNaN(lngNum) || (latNum === 0 && lngNum === 0)) {
      setLocationError("Please provide valid coordinates or search for a location.");
      return;
    }

    try {
      setSavingLocation(true);
      setLocationError(null);

      const updatedLocation = {
        lat: latNum,
        lng: lngNum,
        address: manualAddress.trim()
      };

      await apiClient.put(`/restaurants/${locationModalApp._id}`, {
        location: updatedLocation,
        locationNeedsReview: false
      });

      // Update state locally
      setRestaurants(prev => prev.map(r => r._id === locationModalApp._id ? {
        ...r,
        location: updatedLocation,
        locationNeedsReview: false
      } : r));

      if (selectedApp?._id === locationModalApp._id) {
        setSelectedApp((prev: any) => prev ? {
          ...prev,
          location: updatedLocation,
          locationNeedsReview: false
        } : null);
      }

      setLocationModalApp(null);
      alert("Restaurant location pin updated successfully!");
    } catch (err: any) {
      console.error("Failed to update restaurant location:", err);
      setLocationError(err.response?.data?.message || "Failed to update restaurant location.");
    } finally {
      setSavingLocation(false);
    }
  };

  const handleAction = async (type: "restaurant" | "delivery", id: string, action: "approve" | "reject") => {
    if (action === "approve" && type === "restaurant") {
      const rest = restaurants.find(r => r._id === id) || (selectedApp?._id === id ? selectedApp : null);
      if (rest && (rest.locationNeedsReview || !rest.location?.lat || !rest.location?.lng || (rest.location.lat === 0 && rest.location.lng === 0))) {
        alert("This restaurant's location hasn't been confirmed yet. Please set its map pin before approving.");
        handleOpenSetLocation(rest);
        return;
      }
    }

    try {
      await apiClient.patch(`/admin/applications/${type}/${id}/${action}`);
      // Refresh list
      fetchApplications();
      if (selectedApp?._id === id) {
        setSelectedApp(null);
      }
    } catch (error: any) {
      console.error(`Failed to ${action} application`, error);
      alert(error.response?.data?.message || `Failed to ${action} application`);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Loading applications...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-50">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-[28px] font-bold text-slate-900 tracking-tight leading-none">Partner Applications</h2>
          <p className="text-sm text-slate-500 mt-2">Review and approve new partners to join the fleet and platform.</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200 mb-6">
        <button 
          onClick={() => setTab("restaurants")}
          className={`pb-3 px-2 text-sm font-bold transition-all border-b-2 ${tab === "restaurants" ? "border-[#FF5C00] text-[#FF5C00]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          Restaurants ({restaurants.length})
        </button>
        <button 
          onClick={() => setTab("deliveries")}
          className={`pb-3 px-2 text-sm font-bold transition-all border-b-2 ${tab === "deliveries" ? "border-[#FF5C00] text-[#FF5C00]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          Delivery Boys ({deliveries.length})
        </button>
      </div>

      <div className="space-y-4">
        {tab === "restaurants" && (
          restaurants.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center text-slate-500 text-sm">
              No pending restaurant applications.
            </div>
          ) : (
            restaurants.map((app) => {
              const hasValidCoords = app.location?.lat && app.location?.lng && (app.location.lat !== 0 || app.location.lng !== 0);
              const needsReview = app.locationNeedsReview || !hasValidCoords;

              return (
                <div key={app._id} className={`bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${needsReview ? "border-amber-200 bg-amber-50/20" : "border-slate-100"}`}>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-slate-900">{app.name}</h3>
                      {needsReview ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full">
                          <MdWarning className="text-[12px] text-amber-600" />
                          ⚠️ Location not found — set pin manually before approving.
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                          <MdLocationOn className="text-[12px]" />
                          Geocoded ({app.location.lat.toFixed(4)}, {app.location.lng.toFixed(4)})
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-1">Owner: {app.owner?.name || "N/A"} | Phone: {app.phone}</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 mt-1">
                      <span>Address: {app.location?.address}</span>
                      {hasValidCoords && (
                        <a
                          href={`https://www.google.com/maps?q=${app.location.lat},${app.location.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#FF5C00] hover:underline"
                        >
                          <MdOpenInNew className="text-[12px]" />
                          View on Map
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 md:gap-3">
                    {needsReview && (
                      <button 
                        onClick={() => handleOpenSetLocation(app)}
                        className="px-3.5 py-2 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors text-sm flex items-center gap-1 shadow-sm shadow-amber-500/20"
                      >
                        <MdEditLocation className="text-[16px]" />
                        Set Location
                      </button>
                    )}
                    <button 
                      onClick={() => { setSelectedApp(app); setSelectedAppType("restaurant"); }}
                      className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm flex items-center gap-1.5"
                    >
                      <MdVisibility className="text-[16px]" />
                      View
                    </button>
                    <button 
                      onClick={() => handleAction("restaurant", app._id, "reject")}
                      className="px-4 py-2 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors text-sm"
                    >
                      Reject
                    </button>
                    <button 
                      onClick={() => handleAction("restaurant", app._id, "approve")}
                      className="px-4 py-2 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors text-sm shadow-sm shadow-green-500/20"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              );
            })
          )
        )}

        {tab === "deliveries" && (
          deliveries.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center text-slate-500 text-sm">
              No pending delivery boy applications.
            </div>
          ) : (
            deliveries.map((app) => (
              <div key={app._id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{app.fullName}</h3>
                  <p className="text-sm text-slate-600 mt-1">Phone: {app.phone} | Vehicle: <span className="uppercase">{app.vehicleType}</span> ({app.vehicleNumber})</p>
                  <p className="text-sm text-slate-500 mt-1">Address: {app.address}</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => { setSelectedApp(app); setSelectedAppType("delivery"); }}
                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm flex items-center gap-1.5"
                  >
                    <MdVisibility className="text-[16px]" />
                    View
                  </button>
                  <button 
                    onClick={() => handleAction("delivery", app._id, "reject")}
                    className="px-4 py-2 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors text-sm"
                  >
                    Reject
                  </button>
                  <button 
                    onClick={() => handleAction("delivery", app._id, "approve")}
                    className="px-4 py-2 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors text-sm"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* View Application Details Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-slate-900/50 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0" onClick={() => setSelectedApp(null)}></div>
          
          <div className="bg-white rounded-2xl shadow-xl w-[90vw] md:w-[540px] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 relative z-10">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Application Details</h3>
              <button 
                onClick={() => setSelectedApp(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100"
              >
                <MdClose className="text-xl" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {selectedAppType === "restaurant" && (
                <>
                  {/* Warning banner if location pin needs review */}
                  {(selectedApp.locationNeedsReview || !selectedApp.location?.lat || !selectedApp.location?.lng || (selectedApp.location.lat === 0 && selectedApp.location.lng === 0)) && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <MdWarning className="text-amber-600 text-xl shrink-0 mt-0.5" />
                        <div>
                          <h5 className="text-sm font-bold text-amber-900 leading-tight">Location Pin Unresolved</h5>
                          <p className="text-xs text-amber-700 mt-0.5">Address could not be automatically geocoded. Set the location pin before approving.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenSetLocation(selectedApp)}
                        className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-all shrink-0 flex items-center gap-1 shadow-sm"
                      >
                        <MdEditLocation className="text-[14px]" />
                        Set Pin
                      </button>
                    </div>
                  )}

                  <div>
                    <h4 className="text-[13px] font-black text-[#FF5C00] uppercase tracking-wider mb-3 flex items-center gap-2"><MdInfo className="text-[16px]" /> Basic Information</h4>
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <DetailRow label="Restaurant Name" value={selectedApp.name} />
                      <DetailRow label="Owner Name" value={selectedApp.ownerName || (selectedApp.owner?.name || "N/A")} />
                      <DetailRow label="Phone Number" value={selectedApp.phone} />
                      <DetailRow label="Applied At" value={new Date(selectedApp.createdAt).toLocaleString()} />
                      <div className="col-span-2">
                        <DetailRow label="Address" value={selectedApp.location?.address} />
                      </div>
                      <div className="col-span-2">
                        <DetailRow 
                          label="Geocoded Coordinates" 
                          value={
                            selectedApp.location?.lat && selectedApp.location?.lng && (selectedApp.location.lat !== 0 || selectedApp.location.lng !== 0) ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200">
                                  {selectedApp.location.lat}, {selectedApp.location.lng}
                                </span>
                                <a 
                                  href={`https://www.google.com/maps?q=${selectedApp.location.lat},${selectedApp.location.lng}`}
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-bold text-[#FF5C00] hover:underline"
                                >
                                  <MdOpenInNew className="text-[14px]" />
                                  View on Google Maps
                                </a>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-amber-600 font-bold text-xs">No Coordinates Available (lat: 0, lng: 0)</span>
                                <button
                                  onClick={() => handleOpenSetLocation(selectedApp)}
                                  className="text-xs font-bold text-[#FF5C00] hover:underline flex items-center gap-0.5"
                                >
                                  <MdEditLocation className="text-[13px]" />
                                  Set Pin
                                </button>
                              </div>
                            )
                          } 
                        />
                      </div>
                      {/* Embedded Map Sanity Check Preview */}
                      {selectedApp.location?.lat && selectedApp.location?.lng && (selectedApp.location.lat !== 0 || selectedApp.location.lng !== 0) && (
                        <div className="col-span-2 mt-2">
                          <div className="rounded-xl overflow-hidden border border-slate-200 h-40 bg-slate-100">
                            <iframe 
                              title="Restaurant Location Map Preview"
                              width="100%" 
                              height="100%" 
                              frameBorder="0" 
                              scrolling="no" 
                              marginHeight={0} 
                              marginWidth={0} 
                              src={`https://maps.google.com/maps?q=${selectedApp.location.lat},${selectedApp.location.lng}&z=15&output=embed`}
                            />
                          </div>
                        </div>
                      )}
                      <div className="col-span-2">
                        <DetailRow label="Cuisines" value={selectedApp.cuisines || "N/A"} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[13px] font-black text-[#FF5C00] uppercase tracking-wider mb-3 flex items-center gap-2"><MdDescription className="text-[16px]" /> Legal Documents</h4>
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <DetailRow label="FSSAI License" value={selectedApp.fssaiNumber || "N/A"} />
                      <DetailRow label="PAN Card" value={<span className="uppercase">{selectedApp.panNumber || "N/A"}</span>} />
                      <div className="col-span-2">
                        <DetailRow label="GST Number" value={<span className="uppercase">{selectedApp.gstNumber || "Not Provided"}</span>} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[13px] font-black text-[#FF5C00] uppercase tracking-wider mb-3 flex items-center gap-2"><MdAccountBalance className="text-[16px]" /> Bank Details</h4>
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <DetailRow label="Account Number" value={selectedApp.bankDetails?.accountNumber || "N/A"} />
                      <DetailRow label="IFSC Code" value={<span className="uppercase">{selectedApp.bankDetails?.ifscCode || "N/A"}</span>} />
                    </div>
                  </div>
                </>
              )}
              
              {selectedAppType === "delivery" && (
                <>
                  <div>
                    <h4 className="text-[13px] font-black text-[#FF5C00] uppercase tracking-wider mb-3 flex items-center gap-2"><MdPerson className="text-[16px]" /> Personal Details</h4>
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <DetailRow label="Full Name" value={selectedApp.fullName} />
                      <DetailRow label="Phone Number" value={selectedApp.phone} />
                      <DetailRow label="Email" value={selectedApp.email || "Not Provided"} />
                      <DetailRow label="City" value={selectedApp.city || "N/A"} />
                      <div className="col-span-2">
                        <DetailRow label="Address" value={selectedApp.address} />
                      </div>
                      <DetailRow label="Vehicle Type" value={<span className="uppercase">{selectedApp.vehicleType}</span>} />
                      <DetailRow label="Vehicle Number" value={<span className="uppercase">{selectedApp.vehicleNumber || "N/A"}</span>} />
                      <div className="col-span-2">
                        <DetailRow label="Applied At" value={new Date(selectedApp.createdAt).toLocaleString()} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[13px] font-black text-[#FF5C00] uppercase tracking-wider mb-3 flex items-center gap-2"><MdBadge className="text-[16px]" /> KYC Documents</h4>
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <DetailRow label="Aadhaar Number" value={selectedApp.aadhaarNumber || "N/A"} />
                      <DetailRow label="PAN Number" value={<span className="uppercase">{selectedApp.panNumber || "N/A"}</span>} />
                      <DetailRow label="Driving License" value={<span className="uppercase">{selectedApp.licenseNumber || "N/A"}</span>} />
                      <div className="col-span-2">
                        <DetailRow label="ID Proof Upload" value={
                          selectedApp.idProofString === "dummy_base64_string_or_url" 
                            ? "Pending Image Upload (Dummy Provided)" 
                            : selectedApp.idProofString
                        } />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[13px] font-black text-[#FF5C00] uppercase tracking-wider mb-3 flex items-center gap-2"><MdAccountBalance className="text-[16px]" /> Payout Details</h4>
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <DetailRow label="Account Number" value={selectedApp.bankDetails?.accountNumber || "N/A"} />
                      <DetailRow label="IFSC Code" value={<span className="uppercase">{selectedApp.bankDetails?.ifscCode || "N/A"}</span>} />
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end bg-slate-50">
              <button 
                onClick={() => {
                  handleAction(selectedAppType!, selectedApp._id, "reject");
                }}
                className="px-6 py-2.5 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors"
              >
                Reject
              </button>
              <button 
                onClick={() => {
                  handleAction(selectedAppType!, selectedApp._id, "approve");
                }}
                className="px-6 py-2.5 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors shadow-sm shadow-green-500/20"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Restaurant Location Modal */}
      {locationModalApp && (
        <div className="fixed inset-0 bg-slate-900/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setLocationModalApp(null)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-[90vw] md:w-[540px] overflow-hidden flex flex-col max-h-[90vh] relative z-10 animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <MdEditLocation className="text-[#FF5C00] text-xl" />
                  Set Restaurant Location Pin
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{locationModalApp.name}</p>
              </div>
              <button
                onClick={() => setLocationModalApp(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <MdClose className="text-xl" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Search Autocomplete */}
              <div className="relative space-y-1.5">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  Search Address / Landmark (Google Places)
                </label>
                <div className="relative flex items-center">
                  <MdSearch className="text-slate-400 absolute left-4 text-[20px]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search area, landmark, street, city..."
                    className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/10 focus:border-[#FF5C00] transition-all text-xs font-semibold"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-4 text-slate-400 hover:text-slate-600"
                    >
                      <MdCancel className="text-[16px]" />
                    </button>
                  )}
                </div>

                {searching && (
                  <div className="absolute top-[100%] left-0 w-full bg-white border border-slate-100 rounded-2xl mt-1 p-3 text-center text-xs text-slate-400 shadow-xl z-50 flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-slate-350 border-t-[#FF5C00] rounded-full animate-spin"></span>
                    <span>Searching locations...</span>
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
                        <MdLocationOn className="text-[#FF5C00] mt-0.5 shrink-0 text-[18px]" />
                        <span className="text-xs font-medium text-slate-700 leading-snug">{s.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {locationError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-1.5">
                  <MdWarning className="text-[16px] text-rose-500 shrink-0" />
                  <span>{locationError}</span>
                </div>
              )}

              {/* Address Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Formatted Address *</label>
                <textarea
                  rows={2}
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="Full restaurant address"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-[#FF5C00] text-xs font-semibold text-slate-800 resize-none"
                />
              </div>

              {/* Coordinates Input */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Latitude *</label>
                  <input
                    type="number"
                    step="any"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    placeholder="e.g. 28.7041"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-[#FF5C00] text-xs font-semibold text-slate-800"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Longitude *</label>
                  <input
                    type="number"
                    step="any"
                    value={manualLng}
                    onChange={(e) => setManualLng(e.target.value)}
                    placeholder="e.g. 77.1025"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-[#FF5C00] text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              {/* Map Preview */}
              {Number(manualLat) !== 0 && Number(manualLng) !== 0 && !isNaN(Number(manualLat)) && !isNaN(Number(manualLng)) && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Pin Preview</label>
                  <div className="rounded-xl overflow-hidden border border-slate-200 h-36 bg-slate-100">
                    <iframe
                      title="Location Map Pin Preview"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      marginHeight={0}
                      marginWidth={0}
                      src={`https://maps.google.com/maps?q=${manualLat},${manualLng}&z=15&output=embed`}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setLocationModalApp(null)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLocation}
                disabled={savingLocation || !manualAddress.trim() || !manualLat || !manualLng || Number(manualLat) === 0}
                className="px-6 py-2.5 bg-[#FF5C00] hover:bg-[#e05200] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-[#FF5C00]/25 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingLocation ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Saving Location...
                  </>
                ) : (
                  <>
                    <MdSave className="text-[16px]" />
                    Confirm & Save Location
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

const DetailRow = ({ label, value }: { label: string, value: React.ReactNode }) => (
  <div className="flex flex-col">
    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</span>
    <span className="text-sm text-slate-800 font-medium break-words">{value}</span>
  </div>
);
