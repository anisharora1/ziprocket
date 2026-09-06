"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { usePlatform } from "@/context/PlatformContext";
import { useAuth } from "@/context/AuthContext";
import { MdEngineering, MdBlock, MdSchedule, MdClose } from "react-icons/md";

const EXCLUDED_PREFIXES = ["/admin", "/moderator", "/seller", "/delivery", "/register-partner", "/register-delivery", "/auth"];

const formatToAMPM = (timeStr: string): string => {
  if (!timeStr) return "8:00 AM";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}:${(m || 0).toString().padStart(2, "0")} ${ampm}`;
};

export default function PlatformClosedModal() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { settings, isPlatformCurrentlyOpen } = usePlatform();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  const isExcludedRoute = EXCLUDED_PREFIXES.some((prefix) => pathname?.startsWith(prefix));
  if (isExcludedRoute || !user || !settings) return null;

  const isMaintenance = settings.maintenanceMode;
  const isPlatformClosed = !settings.isPlatformOpen;
  const isOutsideHours = !isPlatformCurrentlyOpen() && !isMaintenance && !isPlatformClosed;
  const shouldShow = isMaintenance || isPlatformClosed || isOutsideHours;
  if (!shouldShow) return null;

  let title = "";
  let subtitle = "";
  let Icon = MdSchedule;
  let reasonKey = "hours";

  if (isMaintenance) {
    title = "हम रखरखाव में हैं";
    subtitle = "We're currently performing maintenance. Please check back shortly.";
    Icon = MdEngineering;
    reasonKey = "maintenance";
  } else if (isPlatformClosed) {
    title = "अभी ऑर्डर बंद है";
    subtitle = "Ordering is temporarily unavailable. Please try again later.";
    Icon = MdBlock;
    reasonKey = "closed";
  } else if (isOutsideHours) {
    const openTime = formatToAMPM(settings.operatingHours.open);
    title = "आज के लिए बंद";
    subtitle = `We're closed right now. We'll reopen at ${openTime}.`;
    reasonKey = `hours-${settings.operatingHours.open}`;
  }

  // Re-show if the underlying reason changes (e.g. closed → maintenance) even if a prior banner was dismissed
  if (dismissedFor === reasonKey) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-white border-b border-slate-200 shadow-sm animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
        <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
          <Icon className="text-rose-500 text-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black text-slate-900 leading-tight">{title}</p>
          <p className="text-[11px] font-semibold text-slate-500 leading-tight mt-0.5">{subtitle}</p>
        </div>
        <button
          onClick={() => setDismissedFor(reasonKey)}
          className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 shrink-0"
          aria-label="Dismiss"
        >
          <MdClose className="text-lg" />
        </button>
      </div>
    </div>
  );
}
