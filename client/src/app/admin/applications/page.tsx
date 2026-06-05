"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";

export default function ApplicationsPage() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"restaurants" | "deliveries">("restaurants");
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [selectedAppType, setSelectedAppType] = useState<"restaurant" | "delivery" | null>(null);
  const { token } = useAuth();

  const fetchApplications = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/applications/pending", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setRestaurants(res.data.applications.restaurants);
        setDeliveries(res.data.applications.deliveries);
      }
    } catch (error) {
      console.error("Failed to fetch applications", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchApplications();
    }
  }, [token]);

  const handleAction = async (type: "restaurant" | "delivery", id: string, action: "approve" | "reject") => {
    try {
      await axios.patch(`http://localhost:5000/api/admin/applications/${type}/${id}/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Refresh list
      fetchApplications();
    } catch (error) {
      console.error(`Failed to ${action} application`, error);
      alert(`Failed to ${action} application`);
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
            restaurants.map((app) => (
              <div key={app._id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{app.name}</h3>
                  <p className="text-sm text-slate-600 mt-1">Owner: {app.owner?.name || "N/A"} | Phone: {app.phone}</p>
                  <p className="text-sm text-slate-500 mt-1">Address: {app.location?.address}</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => { setSelectedApp(app); setSelectedAppType("restaurant"); }}
                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
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
                    className="px-4 py-2 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors text-sm"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))
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
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
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

      {/* Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-slate-900/50 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0" onClick={() => setSelectedApp(null)}></div>
          
          <div className="bg-white rounded-2xl shadow-xl w-[90vw] md:w-[500px] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 relative z-10">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Application Details</h3>
              <button 
                onClick={() => setSelectedApp(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {selectedAppType === "restaurant" && (
                <>
                  <div>
                    <h4 className="text-[13px] font-black text-[#FF5C00] uppercase tracking-wider mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">info</span> Basic Information</h4>
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <DetailRow label="Restaurant Name" value={selectedApp.name} />
                      <DetailRow label="Owner Name" value={selectedApp.ownerName || (selectedApp.owner?.name || "N/A")} />
                      <DetailRow label="Phone Number" value={selectedApp.phone} />
                      <DetailRow label="Applied At" value={new Date(selectedApp.createdAt).toLocaleString()} />
                      <div className="col-span-2">
                        <DetailRow label="Address" value={selectedApp.location?.address} />
                      </div>
                      <div className="col-span-2">
                        <DetailRow label="Cuisines" value={selectedApp.cuisines || "N/A"} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[13px] font-black text-[#FF5C00] uppercase tracking-wider mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">description</span> Legal Documents</h4>
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <DetailRow label="FSSAI License" value={selectedApp.fssaiNumber || "N/A"} />
                      <DetailRow label="PAN Card" value={<span className="uppercase">{selectedApp.panNumber || "N/A"}</span>} />
                      <div className="col-span-2">
                        <DetailRow label="GST Number" value={<span className="uppercase">{selectedApp.gstNumber || "Not Provided"}</span>} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[13px] font-black text-[#FF5C00] uppercase tracking-wider mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">account_balance</span> Bank Details</h4>
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
                    <h4 className="text-[13px] font-black text-[#FF5C00] uppercase tracking-wider mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">person</span> Personal Details</h4>
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
                    <h4 className="text-[13px] font-black text-[#FF5C00] uppercase tracking-wider mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">badge</span> KYC Documents</h4>
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
                    <h4 className="text-[13px] font-black text-[#FF5C00] uppercase tracking-wider mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">account_balance</span> Payout Details</h4>
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
                  setSelectedApp(null);
                }}
                className="px-6 py-2.5 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors"
              >
                Reject
              </button>
              <button 
                onClick={() => {
                  handleAction(selectedAppType!, selectedApp._id, "approve");
                  setSelectedApp(null);
                }}
                className="px-6 py-2.5 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors shadow-sm shadow-green-500/20"
              >
                Approve
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
