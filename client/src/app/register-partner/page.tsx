"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Step = 1 | 2 | 3;

export default function RestaurantPartnerForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [zones, setZones] = useState<any[]>([]);

  useEffect(() => {
    const fetchZones = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/delivery-zones");
        const data = await res.json();
        if (data.success) {
          setZones(data.zones.filter((z: any) => z.isActive) || []);
        }
      } catch (err) {
        console.error("Failed to load active delivery zones:", err);
      }
    };
    fetchZones();
  }, []);

  const [formData, setFormData] = useState({
    // Step 1: Info
    restaurantName: "",
    address: "",
    ownerName: "",
    phone: "",
    cuisines: "",
    deliveryZone: "",
    // Step 2: Docs
    fssaiNumber: "",
    panNumber: "",
    gstNumber: "",
    // Step 3: Bank
    accountNumber: "",
    ifscCode: "",
    agreed: false
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const nextStep = () => {
    if (step < 3) setStep((prev) => (prev + 1) as Step);
  };

  const prevStep = () => {
    if (step > 1) setStep((prev) => (prev - 1) as Step);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      nextStep();
      return;
    }

    if (!formData.agreed) {
      alert("Please accept the terms and conditions.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Get token from localStorage
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Please login first to apply.");
        router.push("/auth/login");
        return;
      }

      const res = await fetch("http://localhost:5000/api/applications/restaurant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsSuccess(true);
      } else {
        alert(data.message || "Failed to submit application.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while submitting.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center w-full">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shrink-0">
          <span className="material-symbols-outlined text-[48px]">check_circle</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Application Submitted!</h1>
        <p className="text-slate-600 w-full max-w-[320px] mx-auto mb-8 font-medium leading-relaxed">
          Thank you for joining ZipRocket! Our team will verify your documents and reach out to you within 24-48 hours.
        </p>
        <Link href="/" className="w-full max-w-[240px] py-4 bg-[#FF5C00] text-white font-black rounded-2xl shadow-lg hover:bg-[#e05200] transition-colors active:scale-95 flex items-center justify-center">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-['Plus_Jakarta_Sans'] pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 px-4 h-16 flex items-center justify-between shadow-sm">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-50 text-slate-700">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#FF5C00] rounded-lg flex items-center justify-center">
             <span className="material-symbols-outlined text-white text-[18px]">storefront</span>
          </div>
          <span className="font-black text-lg tracking-tight text-slate-900">Partner with Us</span>
        </div>
        <div className="w-10"></div>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-8">
        {/* Progress Bar */}
        <div className="mb-10">
          <div className="flex justify-between mb-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex flex-col items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mb-2 transition-all duration-300 ${
                  step === s ? 'bg-[#FF5C00] text-white ring-4 ring-[#FF5C00]/10' : 
                  step > s ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  {step > s ? <span className="material-symbols-outlined text-[18px]">check</span> : s}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wider ${step >= s ? 'text-slate-900' : 'text-slate-400'}`}>
                  {s === 1 ? 'Information' : s === 2 ? 'Documents' : 'Contract'}
                </span>
              </div>
            ))}
          </div>
          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden relative">
            <div 
              className="absolute top-0 left-0 h-full bg-[#FF5C00] transition-all duration-500 ease-out"
              style={{ width: `${((step - 1) / 2) * 100}%` }}
            />
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {step === 1 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-2">
                  <h2 className="text-xl font-black text-slate-900">Restaurant Information</h2>
                  <p className="text-sm text-slate-500">Tell us basic details about your restaurant</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase mb-1.5 ml-1">Restaurant Name</label>
                    <input 
                      required
                      type="text"
                      name="restaurantName"
                      value={formData.restaurantName}
                      onChange={handleInputChange}
                      placeholder="e.g. Royal Kitchen"
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/20 focus:border-[#FF5C00] transition-all text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase mb-1.5 ml-1">Complete Address</label>
                    <textarea 
                      required
                      rows={3}
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder="Street name, Area, City, Pincode"
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/20 focus:border-[#FF5C00] transition-all text-sm font-semibold resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-700 uppercase mb-1.5 ml-1">Owner Full Name</label>
                      <input 
                        required
                        type="text"
                        name="ownerName"
                        value={formData.ownerName}
                        onChange={handleInputChange}
                        placeholder="John Doe"
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/20 focus:border-[#FF5C00] transition-all text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-700 uppercase mb-1.5 ml-1">Contact Number</label>
                      <input 
                        required
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="+91 00000 00000"
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/20 focus:border-[#FF5C00] transition-all text-sm font-semibold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase mb-1.5 ml-1">Cuisines Offered</label>
                    <input 
                      required
                      type="text"
                      name="cuisines"
                      value={formData.cuisines}
                      onChange={handleInputChange}
                      placeholder="North Indian, Chinese, South Indian"
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/20 focus:border-[#FF5C00] transition-all text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase mb-1.5 ml-1">Select Zone</label>
                    <select
                      required
                      name="deliveryZone"
                      value={formData.deliveryZone}
                      onChange={(e) => setFormData(prev => ({ ...prev, deliveryZone: e.target.value }))}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/20 focus:border-[#FF5C00] transition-all text-sm font-semibold"
                    >
                      <option value="">Choose your operating zone</option>
                      {zones.map(zone => (
                        <option key={zone._id} value={zone._id}>{zone.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-2">
                  <h2 className="text-xl font-black text-slate-900">Legal Documents</h2>
                  <p className="text-sm text-slate-500">Provide legal identification for verification</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase mb-1.5 ml-1">FSSAI License Number</label>
                    <input 
                      required
                      type="text"
                      name="fssaiNumber"
                      value={formData.fssaiNumber}
                      onChange={handleInputChange}
                      placeholder="14-digit license number"
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/20 focus:border-[#FF5C00] transition-all text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase mb-1.5 ml-1">PAN Card Number</label>
                    <input 
                      required
                      type="text"
                      name="panNumber"
                      value={formData.panNumber}
                      onChange={handleInputChange}
                      placeholder="ABCDE1234F"
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/20 focus:border-[#FF5C00] transition-all text-sm font-semibold uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase mb-1.5 ml-1">GST Number (Optional)</label>
                    <input 
                      type="text"
                      name="gstNumber"
                      value={formData.gstNumber}
                      onChange={handleInputChange}
                      placeholder="22AAAAA0000A1Z5"
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/20 focus:border-[#FF5C00] transition-all text-sm font-semibold uppercase"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-2">
                  <h2 className="text-xl font-black text-slate-900">Partner Contract</h2>
                  <p className="text-sm text-slate-500">Bank details and partnership agreement</p>
                </div>

                <div className="space-y-4">
                  <div className="bg-[#FF5C00]/5 p-4 rounded-2xl border border-[#FF5C00]/10">
                    <h3 className="text-xs font-black text-[#FF5C00] uppercase mb-2">Commission Terms</h3>
                    <p className="text-[11px] font-medium text-slate-700 leading-relaxed">
                      By joining ZipRocket, you agree to a standard commission fee of 15% per order. Payments are settled every Wednesday for the previous week's orders.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase mb-1.5 ml-1">Bank Account Number</label>
                    <input 
                      required
                      type="password"
                      name="accountNumber"
                      value={formData.accountNumber}
                      onChange={handleInputChange}
                      placeholder="Enter account number"
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/20 focus:border-[#FF5C00] transition-all text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase mb-1.5 ml-1">Bank IFSC Code</label>
                    <input 
                      required
                      type="text"
                      name="ifscCode"
                      value={formData.ifscCode}
                      onChange={handleInputChange}
                      placeholder="SBIN0001234"
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/20 focus:border-[#FF5C00] transition-all text-sm font-semibold uppercase"
                    />
                  </div>
                  
                  <div className="flex items-start gap-3 mt-4 pt-4 border-t border-slate-50">
                    <input 
                      required
                      id="agreed"
                      type="checkbox"
                      name="agreed"
                      checked={formData.agreed}
                      onChange={handleInputChange}
                      className="mt-1 w-5 h-5 rounded-md border-slate-300 text-[#FF5C00] focus:ring-[#FF5C00]"
                    />
                    <label htmlFor="agreed" className="text-xs font-bold text-slate-600 leading-relaxed">
                      I agree to the ZipRocket Partner Terms & Conditions and understand that my information will be verified.
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-4 pt-6 mt-6 border-t border-slate-50">
              {step > 1 && (
                <button 
                  type="button"
                  onClick={prevStep}
                  className="flex-1 py-4 bg-slate-100 text-slate-700 font-black rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
                >
                  Back
                </button>
              )}
              <button 
                type="submit"
                disabled={isSubmitting}
                className="flex-[2] py-4 bg-[#FF5C00] text-white font-black rounded-2xl shadow-lg shadow-[#FF5C00]/20 hover:bg-[#e05200] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Processing...
                  </>
                ) : (
                  <>
                    {step === 3 ? 'Submit Application' : 'Continue'}
                    {step < 3 && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-[10px] text-slate-400 mt-8 font-medium">
          Secure Form. All information is encrypted. Need help? Call 1800-ZIP-ROCKET
        </p>
      </main>
    </div>
  );
}
