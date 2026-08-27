"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/services/api";
import { getFriendlyErrorMessage } from "@/utils/errorHandler";
import {
    MdTwoWheeler,
    MdHome,
    MdArrowBack,
    MdCheck,
    MdPerson,
    MdBadge,
    MdAccountBalance,
    MdInfo,
    MdPayments,
    MdCheckCircle,
    MdArrowForward,
} from "react-icons/md";

type Step = 1 | 2 | 3;

const steps = [
    { id: 1, label: "Personal", iconComp: MdPerson },
    { id: 2, label: "Documents", iconComp: MdBadge },
    { id: 3, label: "Payout", iconComp: MdAccountBalance },
];

const inputClass =
    "w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/25 focus:border-[#FF5C00] transition-all text-[14px] font-medium text-slate-800 placeholder:text-slate-400";
const labelClass = "block text-[11px] font-extrabold text-slate-600 uppercase tracking-widest mb-1.5";

export default function DeliveryRegisterForm() {
    const router = useRouter();
    const [step, setStep] = useState<Step>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [zones, setZones] = useState<any[]>([]);

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

    const [formData, setFormData] = useState({
        fullName: "",
        phone: "",
        email: "",
        city: "",
        vehicleType: "bike",
        vehicleNumber: "",
        deliveryZone: "",
        aadhaarNumber: "",
        licenseNumber: "",
        panNumber: "",
        accountNumber: "",
        ifscCode: "",
        agreed: false,
    });
    const [idProofFile, setIdProofFile] = useState<File | null>(null);

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value, type } = e.target;
        if (type === "checkbox") {
            setFormData((prev) => ({
                ...prev,
                [name]: (e.target as HTMLInputElement).checked,
            }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (step < 3) {
            setStep((prev) => (prev + 1) as Step);
            return;
        }
        if (!formData.agreed) {
            alert("Please accept the delivery partner agreement.");
            return;
        }
        
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                alert("Please login first to apply.");
                router.push("/auth/login");
                return;
            }

            const form = new FormData();
            form.append("fullName", formData.fullName);
            form.append("phone", formData.phone);
            form.append("email", formData.email);
            form.append("city", formData.city);
            form.append("vehicleType", formData.vehicleType);
            form.append("vehicleNumber", formData.vehicleNumber);
            form.append("deliveryZone", formData.deliveryZone);
            form.append("aadhaarNumber", formData.aadhaarNumber);
            form.append("licenseNumber", formData.licenseNumber || "");
            form.append("panNumber", formData.panNumber);
            form.append("accountNumber", formData.accountNumber);
            form.append("ifscCode", formData.ifscCode);
            if (idProofFile) {
                form.append("idProof", idProofFile);
            } else {
                alert("Please select your ID proof document photo.");
                setIsSubmitting(false);
                return;
            }

            const res = await apiClient.post("/applications/delivery", form, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });

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

    // ── Success State ──────────────────────────────────────────────
    if (isSuccess) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 py-12 text-center">
                <div className="w-24 h-24 bg-[#FF5C00]/10 rounded-full flex items-center justify-center mb-6">
                    <MdTwoWheeler className="text-[54px] text-[#FF5C00]" />
                </div>
                <h1 className="text-2xl font-black text-slate-900 mb-3">You&apos;re In the Fleet!</h1>
                <p className="text-slate-600 w-full max-w-[320px] mx-auto mb-8 font-medium leading-relaxed">
                    Our onboarding team will call you within 24 hours to schedule your training and kit collection.
                </p>
                <Link
                    href="/"
                    className="w-full max-w-[260px] py-4 bg-[#FF5C00] text-white font-black rounded-2xl shadow-lg shadow-[#FF5C00]/20 hover:bg-[#e05200] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <MdHome className="text-[18px]" />
                    Back to Home
                </Link>
            </div>
        );
    }

    // ── Main Form ─────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {/* ── Sticky Header ── */}
            <header className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
                    <button
                        onClick={() => (step > 1 ? setStep((p) => (p - 1) as Step) : router.back())}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all text-slate-700"
                    >
                        <MdArrowBack className="text-[20px]" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-[#FF5C00] rounded-lg flex items-center justify-center">
                            <MdTwoWheeler className="text-white text-[16px]" />
                        </div>
                        <span className="font-black text-[15px] text-slate-900 tracking-tight">
                            Delivery Partner
                        </span>
                    </div>
                    <div className="w-9" />
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 pt-6 pb-24">
                {/* ── Step Indicators ── */}
                <div className="mb-8">
                    <div className="flex items-center justify-between relative">
                        {/* Connecting line */}
                        <div className="absolute top-5 left-[16.5%] right-[16.5%] h-0.5 bg-slate-200 z-0">
                            <div
                                className="h-full bg-[#FF5C00] transition-all duration-500"
                                style={{ width: `${((step - 1) / 2) * 100}%` }}
                            />
                        </div>

                        {steps.map((s) => {
                            const done = step > s.id;
                            const active = step === s.id;
                            const StepIcon = s.iconComp;
                            return (
                                <div key={s.id} className="flex flex-col items-center gap-1.5 z-10 flex-1">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${done
                                                ? "bg-green-500 text-white shadow-sm"
                                                : active
                                                    ? "bg-[#FF5C00] text-white shadow-md shadow-[#FF5C00]/30 ring-4 ring-[#FF5C00]/10"
                                                    : "bg-white text-slate-400 border-2 border-slate-200"
                                            }`}
                                    >
                                        {done ? (
                                            <MdCheck className="text-[16px]" />
                                        ) : (
                                            <StepIcon className="text-[18px]" />
                                        )}
                                    </div>
                                    <span
                                        className={`text-[10px] font-black uppercase tracking-wider ${active ? "text-[#FF5C00]" : done ? "text-green-600" : "text-slate-400"
                                            }`}
                                    >
                                        {s.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Form Card ── */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
                    <form onSubmit={handleSubmit}>
                        {/* Step heading */}
                        <div className="px-6 pt-6 pb-5 border-b border-slate-50">
                            <h2 className="text-lg font-black text-slate-900">
                                {step === 1 && "Personal Details"}
                                {step === 2 && "Verification Documents"}
                                {step === 3 && "Payout & Agreement"}
                            </h2>
                            <p className="text-[13px] text-slate-500 mt-0.5">
                                {step === 1 && "Tell us a bit about yourself"}
                                {step === 2 && "Required for KYC verification"}
                                {step === 3 && "Your weekly earnings will go here"}
                            </p>
                        </div>

                        {/* Fields */}
                        <div className="px-6 py-6 space-y-5">
                            {/* ── Step 1 ── */}
                            {step === 1 && (
                                <div className="space-y-4">
                                    <div>
                                        <label className={labelClass}>Full Name</label>
                                        <input
                                            required
                                            type="text"
                                            name="fullName"
                                            value={formData.fullName}
                                            onChange={handleInputChange}
                                            placeholder="e.g. Rahul Sharma"
                                            className={inputClass}
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>Phone Number</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[13px] font-semibold">+91</span>
                                            <input
                                                required
                                                type="tel"
                                                name="phone"
                                                value={formData.phone}
                                                onChange={handleInputChange}
                                                placeholder="9876543210"
                                                pattern="[6-9][0-9]{9}"
                                                maxLength={10}
                                                className={`${inputClass} pl-12`}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClass}>Email Address <span className="normal-case text-slate-400 font-medium">(optional)</span></label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            placeholder="you@example.com"
                                            className={inputClass}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div>
                                            <label className={labelClass}>City</label>
                                            <input
                                                required
                                                type="text"
                                                name="city"
                                                value={formData.city}
                                                onChange={handleInputChange}
                                                placeholder="New Delhi"
                                                className={inputClass}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Vehicle Type</label>
                                            <select
                                                name="vehicleType"
                                                value={formData.vehicleType}
                                                onChange={handleInputChange}
                                                className={inputClass}
                                            >
                                                <option value="bike">🏍️ Bike</option>
                                                <option value="e-bike">⚡ E-Bike / Scooter</option>
                                                <option value="scooter">🛵 Scooter</option>
                                                <option value="bicycle">🚲 Bicycle</option>
                                                <option value="other">🚗 Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Vehicle Number</label>
                                            <input
                                                required
                                                type="text"
                                                name="vehicleNumber"
                                                value={formData.vehicleNumber}
                                                onChange={(e) => setFormData(prev => ({ ...prev, vehicleNumber: e.target.value.toUpperCase() }))}
                                                placeholder="e.g. DL01AB1234"
                                                className={`${inputClass} uppercase`}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Select Zone</label>
                                        <select
                                            required
                                            name="deliveryZone"
                                            value={formData.deliveryZone}
                                            onChange={(e) => setFormData(prev => ({ ...prev, deliveryZone: e.target.value }))}
                                            className={inputClass}
                                        >
                                            <option value="">Choose your operating zone</option>
                                            {zones.map(zone => (
                                                <option key={zone._id} value={zone._id}>{zone.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* ── Step 2 ── */}
                            {step === 2 && (
                                <div className="space-y-4">
                                    <div>
                                        <label className={labelClass}>Aadhaar Card Number</label>
                                        <input
                                            required
                                            type="text"
                                            name="aadhaarNumber"
                                            value={formData.aadhaarNumber}
                                            onChange={handleInputChange}
                                            placeholder="12-digit Aadhaar number"
                                            pattern="[0-9]{12}"
                                            maxLength={12}
                                            className={inputClass}
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1 ml-1">12-digit Aadhaar number</p>
                                    </div>

                                    {formData.vehicleType !== "bicycle" && formData.vehicleType !== "cycle" && (
                                        <div>
                                            <label className={labelClass}>Driving License Number</label>
                                            <input
                                                required
                                                type="text"
                                                name="licenseNumber"
                                                value={formData.licenseNumber}
                                                onChange={handleInputChange}
                                                placeholder="DL-0420110012345"
                                                className={`${inputClass} uppercase`}
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className={labelClass}>PAN Card Number</label>
                                        <input
                                            required
                                            type="text"
                                            name="panNumber"
                                            value={formData.panNumber}
                                            onChange={(e) => setFormData(prev => ({ ...prev, panNumber: e.target.value.toUpperCase() }))}
                                            placeholder="ABCDE1234F"
                                            pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}"
                                            maxLength={10}
                                            className={`${inputClass} uppercase`}
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>Upload ID Proof (Aadhaar/License/PAN Photo) *</label>
                                        <input
                                            required
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setIdProofFile(e.target.files[0]);
                                                }
                                            }}
                                            className={inputClass}
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1 ml-1">Upload JPEG, PNG or WebP image up to 5MB</p>
                                    </div>

                                    {/* Info note */}
                                    <div className="flex gap-3 bg-blue-50 p-3.5 rounded-xl border border-blue-100">
                                        <MdInfo className="text-blue-500 text-[18px] shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                                            Your documents are encrypted and used only for identity verification. We never share your data.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* ── Step 3 ── */}
                            {step === 3 && (
                                <div className="space-y-4">
                                    {/* Earnings card */}
                                    <div className="bg-gradient-to-br from-[#FF5C00] to-[#ff7a2e] p-4 rounded-2xl text-white">
                                        <div className="flex items-center gap-2 mb-2">
                                            <MdPayments className="text-[18px]" />
                                            <h3 className="text-[11px] font-black uppercase tracking-wider">Earnings Structure</h3>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3 mt-3">
                                            {[
                                                { label: "Per Delivery", value: "₹30+" },
                                                { label: "Distance Bonus", value: "+₹5/km" },
                                                { label: "Payout Day", value: "Monday" },
                                            ].map((item) => (
                                                <div key={item.label} className="bg-white/15 rounded-xl p-2.5 text-center">
                                                    <p className="text-[11px] font-black">{item.value}</p>
                                                    <p className="text-[9px] opacity-80 font-medium mt-0.5">{item.label}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClass}>Bank Account Number</label>
                                        <input
                                            required
                                            type="password"
                                            name="accountNumber"
                                            value={formData.accountNumber}
                                            onChange={handleInputChange}
                                            placeholder="Enter account number (9-18 digits)"
                                            pattern="[0-9]{9,18}"
                                            minLength={9}
                                            maxLength={18}
                                            className={inputClass}
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>Bank IFSC Code</label>
                                        <input
                                            required
                                            type="text"
                                            name="ifscCode"
                                            value={formData.ifscCode}
                                            onChange={(e) => setFormData(prev => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))}
                                            placeholder="SBIN0001234"
                                            pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}"
                                            maxLength={11}
                                            className={`${inputClass} uppercase`}
                                        />
                                    </div>

                                    {/* Agreement */}
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input
                                                required
                                                id="agreed"
                                                type="checkbox"
                                                name="agreed"
                                                checked={formData.agreed}
                                                onChange={handleInputChange}
                                                className="mt-0.5 w-5 h-5 shrink-0 rounded border-slate-300 accent-[#FF5C00]"
                                            />
                                            <span className="text-[12px] font-semibold text-slate-600 leading-relaxed">
                                                I agree to the{" "}
                                                <span className="text-[#FF5C00] underline">Delivery Partner Agreement</span>{" "}
                                                and confirm that all details provided above are accurate and true.
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Action Buttons ── */}
                        <div className="px-6 pb-6">
                            <div className="flex gap-3">
                                {step > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => setStep((p) => (p - 1) as Step)}
                                        className="flex-1 py-3.5 bg-slate-100 text-slate-700 font-black text-[14px] rounded-xl hover:bg-slate-200 active:scale-95 transition-all"
                                    >
                                        ← Back
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-[2] py-3.5 bg-[#FF5C00] text-white font-black text-[14px] rounded-xl shadow-lg shadow-[#FF5C00]/20 hover:bg-[#e05200] active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Processing...
                                        </>
                                    ) : step === 3 ? (
                                        <>
                                            <MdCheckCircle className="text-[18px]" />
                                            Complete Registration
                                        </>
                                    ) : (
                                        <>
                                            Continue
                                            <MdArrowForward className="text-[18px]" />
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Step count */}
                            <p className="text-center text-[11px] text-slate-400 mt-4 font-medium">
                                Step {step} of 3 •{" "}
                                {step === 1 ? "2 more steps" : step === 2 ? "1 more step" : "Final step"}
                            </p>
                        </div>
                    </form>
                </div>

                <p className="text-center text-[10px] text-slate-400 mt-6">
                    🔒 Secure & Encrypted • ZipRocket Fleet Registration
                </p>
            </main>
        </div>
    );
}

