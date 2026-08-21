"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/services/api";
import { getFriendlyErrorMessage } from "@/utils/errorHandler";
import { 
  MdCheckCircle, 
  MdArrowBack, 
  MdStorefront, 
  MdCheck, 
  MdArrowForward,
  MdClose,
  MdDescription
} from "react-icons/md";

type Step = 1 | 2 | 3;

export default function RestaurantPartnerForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [showTermsModal, setShowTermsModal] = useState(false);

  useEffect(() => {
    const fetchZones = async () => {
      try {
        const res = await apiClient.get("/delivery-zones");
        if (res.data.success) {
          setZones(res.data.zones.filter((z: any) => z.isActive) || []);
        }
      } catch (err) {
        console.error("Failed to load active delivery zones:", err);
      }
    };
    fetchZones();
  }, []);

  useEffect(() => {
    if (showTermsModal) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") setShowTermsModal(false);
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [showTermsModal]);

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

      const res = await apiClient.post("/applications/restaurant", formData);

      if (res.data && res.data.success) {
        setIsSuccess(true);
      } else {
        alert(res.data?.message || "Failed to submit application.");
      }
    } catch (err: any) {
      console.error(err);
      alert(getFriendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center w-full">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shrink-0">
          <MdCheckCircle className="text-[48px]" />
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
          <MdArrowBack className="text-xl" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#FF5C00] rounded-lg flex items-center justify-center">
            <MdStorefront className="text-white text-[18px]" />
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
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mb-2 transition-all duration-300 ${step === s ? 'bg-[#FF5C00] text-white ring-4 ring-[#FF5C00]/10' :
                    step > s ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                  {step > s ? <MdCheck className="text-[18px]" /> : s}
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
                    <div className="flex items-center justify-between mb-1.5">
                      <h3 className="text-xs font-black text-[#FF5C00] uppercase">Commission Terms</h3>
                      <button
                        type="button"
                        onClick={() => setShowTermsModal(true)}
                        className="text-[11px] font-bold text-[#FF5C00] hover:underline"
                      >
                        View Full Terms
                      </button>
                    </div>
                    <p className="text-[11px] font-medium text-slate-700 leading-relaxed">
                      By joining ZipRocket, you agree to a standard commission fee of 5% on eligible order value. Payments are settled on scheduled payout cycles.
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
                      className="mt-1 w-5 h-5 rounded-md border-slate-300 text-[#FF5C00] focus:ring-[#FF5C00] accent-[#FF5C00] cursor-pointer shrink-0"
                    />
                    <label htmlFor="agreed" className="text-xs font-bold text-slate-600 leading-relaxed cursor-pointer select-none">
                      I agree to the{" "}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowTermsModal(true);
                        }}
                        className="text-[#FF5C00] hover:text-[#e05200] underline font-black transition-colors inline focus:outline-none"
                      >
                        Terms &amp; Conditions
                      </button>{" "}
                      and understand that my information will be verified.
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
                    {step < 3 && <MdArrowForward className="text-[18px]" />}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-[10px] text-slate-400 mt-8 font-medium">
          Secure Form. All information is encrypted. Need help? Call +91 9117662441
        </p>
      </main>

      {/* Terms & Conditions Modal */}
      {showTermsModal && (
        <div
          onClick={() => setShowTermsModal(false)}
          className="fixed inset-0 bg-slate-950/60 z-[9999] flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-[0_25px_60px_rgba(0,0,0,0.3)] border border-slate-100 animate-in zoom-in-95 duration-200 overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-orange-50/70 via-white to-orange-50/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FF5C00]/10 text-[#FF5C00] flex items-center justify-center font-bold shrink-0">
                  <MdDescription className="text-xl" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                    Terms &amp; Conditions
                  </h2>
                  <p className="text-[11px] sm:text-xs font-bold text-slate-500">
                    ZipRocket Restaurant Partner Agreement
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all focus:outline-none"
                aria-label="Close modal"
              >
                <MdClose className="text-xl" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 text-slate-700 text-xs sm:text-sm leading-relaxed overscroll-contain">
              {/* Notice Banner */}
              <div className="bg-gradient-to-r from-[#FF5C00]/10 to-[#FF5C00]/5 border border-[#FF5C00]/20 rounded-2xl p-4">
                <p className="font-black text-[#FF5C00] uppercase text-[10px] sm:text-[11px] tracking-wider mb-1">
                  Agreement Overview
                </p>
                <p className="font-semibold text-slate-800">
                  By registering and accepting orders through ZipRocket, the Restaurant Partner agrees to the following terms:
                </p>
              </div>

              {/* Terms Sections */}
              <div className="space-y-4">
                {/* 1 */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                  <h3 className="font-black text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FF5C00] text-white text-[10px] flex items-center justify-center font-black shrink-0">1</span>
                    Restaurant Responsibility
                  </h3>
                  <p className="text-slate-600 text-xs font-medium leading-relaxed pl-7">
                    The Restaurant Partner is responsible for preparing, packing, and handing over the correct food items according to the customer's order.
                  </p>
                </div>

                {/* 2 */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                  <h3 className="font-black text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FF5C00] text-white text-[10px] flex items-center justify-center font-black shrink-0">2</span>
                    Food Quality &amp; Correct Order
                  </h3>
                  <div className="text-slate-600 text-xs font-medium leading-relaxed pl-7 space-y-2">
                    <p>
                      The Restaurant Partner is responsible for ensuring that the food is fresh, properly prepared, properly packed, and matches the customer's order.
                    </p>
                    <p>
                      If a customer reports that the restaurant provided the wrong food, missing item, or incorrect order, ZipRocket may investigate the complaint.
                    </p>
                  </div>
                </div>

                {/* 3 */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                  <h3 className="font-black text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FF5C00] text-white text-[10px] flex items-center justify-center font-black shrink-0">3</span>
                    Wrong Food / Incorrect Order Investigation
                  </h3>
                  <div className="text-slate-600 text-xs font-medium leading-relaxed pl-7 space-y-2">
                    <p>
                      If a customer reports an incorrect order, ZipRocket may first verify the complaint with the customer and request appropriate evidence, such as photos or videos.
                    </p>
                    <p>
                      If the complaint appears valid, ZipRocket may share the relevant evidence with the Restaurant Partner for verification.
                    </p>
                    <p>
                      If the Restaurant Partner confirms that the wrong item/order was provided, or the evidence reasonably establishes that the issue was caused by the Restaurant Partner, the Restaurant Partner will be responsible for the affected order and any applicable customer resolution.
                    </p>
                    <p>
                      If the investigation establishes that the Restaurant Partner provided the correct order and the complaint is not attributable to the Restaurant Partner, ZipRocket will not hold the Restaurant Partner responsible for that complaint.
                    </p>
                  </div>
                </div>

                {/* 4 */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                  <h3 className="font-black text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FF5C00] text-white text-[10px] flex items-center justify-center font-black shrink-0">4</span>
                    ZipRocket's Role
                  </h3>
                  <div className="text-slate-600 text-xs font-medium leading-relaxed pl-7 space-y-2">
                    <p>
                      ZipRocket acts as a technology and delivery platform connecting customers, restaurants, and delivery partners.
                    </p>
                    <p>
                      ZipRocket is not responsible for the preparation, quality, quantity, ingredients, or correctness of food prepared by the Restaurant Partner.
                    </p>
                  </div>
                </div>

                {/* 5 */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                  <h3 className="font-black text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FF5C00] text-white text-[10px] flex items-center justify-center font-black shrink-0">5</span>
                    Commission
                  </h3>
                  <div className="text-slate-600 text-xs font-medium leading-relaxed pl-7 space-y-2">
                    <p>
                      ZipRocket will charge the Restaurant Partner a 5% commission on eligible order value, subject to applicable taxes and any other charges expressly agreed with the Restaurant Partner.
                    </p>
                    <p>
                      No additional commission should be applied unless it is clearly communicated and agreed to by the Restaurant Partner.
                    </p>
                  </div>
                </div>

                {/* 6 */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                  <h3 className="font-black text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FF5C00] text-white text-[10px] flex items-center justify-center font-black shrink-0">6</span>
                    Menu &amp; Pricing
                  </h3>
                  <div className="text-slate-600 text-xs font-medium leading-relaxed pl-7 space-y-2">
                    <p>
                      The Restaurant Partner must provide accurate information about its menu items, prices, availability, descriptions, and applicable food information.
                    </p>
                    <p>
                      The Restaurant Partner is responsible for updating incorrect or outdated information.
                    </p>
                  </div>
                </div>

                {/* 7 */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                  <h3 className="font-black text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FF5C00] text-white text-[10px] flex items-center justify-center font-black shrink-0">7</span>
                    Order Acceptance &amp; Preparation
                  </h3>
                  <div className="text-slate-600 text-xs font-medium leading-relaxed pl-7 space-y-2">
                    <p>
                      The Restaurant Partner must accept and prepare orders within a reasonable time and ensure that the order is ready for the delivery partner when required.
                    </p>
                    <p>
                      Repeated rejection, cancellation, or failure to prepare accepted orders may result in temporary suspension or other action by ZipRocket.
                    </p>
                  </div>
                </div>

                {/* 8 */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                  <h3 className="font-black text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FF5C00] text-white text-[10px] flex items-center justify-center font-black shrink-0">8</span>
                    Packaging
                  </h3>
                  <div className="text-slate-600 text-xs font-medium leading-relaxed pl-7 space-y-2">
                    <p>
                      The Restaurant Partner must use suitable and secure packaging to ensure that the food reaches the customer in an appropriate condition.
                    </p>
                    <p>
                      ZipRocket will not be responsible for problems caused by inadequate restaurant packaging.
                    </p>
                  </div>
                </div>

                {/* 9 */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                  <h3 className="font-black text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FF5C00] text-white text-[10px] flex items-center justify-center font-black shrink-0">9</span>
                    Customer Complaints
                  </h3>
                  <div className="text-slate-600 text-xs font-medium leading-relaxed pl-7 space-y-2">
                    <p>
                      ZipRocket may review customer complaints and supporting evidence before deciding whether an issue is attributable to the Restaurant Partner, delivery partner, customer, or another party.
                    </p>
                    <p>
                      ZipRocket may request information or evidence from the Restaurant Partner during an investigation.
                    </p>
                  </div>
                </div>

                {/* 10 */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                  <h3 className="font-black text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FF5C00] text-white text-[10px] flex items-center justify-center font-black shrink-0">10</span>
                    Customer Fraud / False Complaints
                  </h3>
                  <div className="text-slate-600 text-xs font-medium leading-relaxed pl-7 space-y-2">
                    <p>
                      ZipRocket may investigate complaints that appear suspicious, inconsistent, or potentially fraudulent.
                    </p>
                    <p>
                      A Restaurant Partner should not be penalized solely because a customer makes a complaint. Appropriate evidence and investigation should be considered before determining responsibility.
                    </p>
                  </div>
                </div>

                {/* 11 */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                  <h3 className="font-black text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FF5C00] text-white text-[10px] flex items-center justify-center font-black shrink-0">11</span>
                    Compliance
                  </h3>
                  <p className="text-slate-600 text-xs font-medium leading-relaxed pl-7">
                    The Restaurant Partner is responsible for complying with all applicable laws, food-safety requirements, licenses, registrations, and regulations applicable to its restaurant and food business.
                  </p>
                </div>

                {/* 12 */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                  <h3 className="font-black text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FF5C00] text-white text-[10px] flex items-center justify-center font-black shrink-0">12</span>
                    Suspension or Termination
                  </h3>
                  <p className="text-slate-600 text-xs font-medium leading-relaxed pl-7">
                    ZipRocket may temporarily suspend or remove a Restaurant Partner from the platform in cases including repeated incorrect orders, serious customer complaints, fraudulent activity, unsafe food practices, misuse of the platform, or violation of these Terms.
                  </p>
                </div>

                {/* 13 */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                  <h3 className="font-black text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FF5C00] text-white text-[10px] flex items-center justify-center font-black shrink-0">13</span>
                    Changes to Terms
                  </h3>
                  <p className="text-slate-600 text-xs font-medium leading-relaxed pl-7">
                    ZipRocket may update these terms when necessary. Material changes may be communicated to Restaurant Partners through the platform or other available communication methods.
                  </p>
                </div>

                {/* 14 */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                  <h3 className="font-black text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FF5C00] text-white text-[10px] flex items-center justify-center font-black shrink-0">14</span>
                    Acceptance
                  </h3>
                  <p className="text-slate-600 text-xs font-medium leading-relaxed pl-7">
                    By registering as a Restaurant Partner and continuing to use ZipRocket to receive orders, the Restaurant Partner acknowledges that it has read, understood, and agreed to these Terms &amp; Conditions.
                  </p>
                </div>
              </div>

              {/* Legal Disclaimer Box */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-[11px] sm:text-xs text-amber-900 font-semibold leading-relaxed">
                <p className="font-black text-amber-800 uppercase text-[10px] mb-1 tracking-wider">
                  ZipRocket — Restaurant Partner Agreement
                </p>
                These terms are intended to establish the operating rules between ZipRocket and Restaurant Partners and should be reviewed for compliance with applicable Indian laws before being used as a binding commercial agreement.
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs sm:text-sm font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, agreed: true }));
                  setShowTermsModal(false);
                }}
                className="px-6 py-3 rounded-2xl bg-[#FF5C00] text-white text-xs sm:text-sm font-black hover:bg-[#e05200] transition-all active:scale-95 shadow-md shadow-[#FF5C00]/20 flex items-center gap-2"
              >
                <MdCheck className="text-lg" />
                <span>I Agree &amp; Accept</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

