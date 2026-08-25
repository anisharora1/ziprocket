"use client";
import { usePathname } from "next/navigation";
import { usePlatform } from "@/context/PlatformContext";
import { useAuth } from "@/context/AuthContext";
import { MdEngineering, MdBlock, MdSchedule } from "react-icons/md";

const EXCLUDED_PREFIXES = [
  "/admin",
  "/moderator",
  "/seller",
  "/delivery",
  "/register-partner",
  "/register-delivery",
  "/auth"
];

const formatToAMPM = (timeStr: string): string => {
  if (!timeStr) return "8:00 AM";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  const displayM = (m || 0).toString().padStart(2, '0');
  return `${displayH}:${displayM} ${ampm}`;
};

export default function PlatformClosedModal() {
  const pathname = usePathname();
  const { settings, isPlatformCurrentlyOpen } = usePlatform();
  const { user } = useAuth();

  const isExcludedRoute = EXCLUDED_PREFIXES.some((prefix) => pathname?.startsWith(prefix));
  if (isExcludedRoute) return null;
  if (!user) return null;

  if (!settings) return null;

  const isMaintenance = settings.maintenanceMode;
  const isPlatformClosed = !settings.isPlatformOpen;
  const isOutsideHours = !isPlatformCurrentlyOpen() && !isMaintenance && !isPlatformClosed;
  const shouldShow = isMaintenance || isPlatformClosed || isOutsideHours;
  if (!shouldShow) return null;

  let title = "";
  let subtitle = "";
  let Icon = MdSchedule;

  if (isMaintenance) {
    title = "हम रखरखाव में हैं";
    subtitle = "We're currently performing maintenance. Please check back shortly.";
    Icon = MdEngineering;
  } else if (isPlatformClosed) {
    title = "अभी ऑर्डर बंद है";
    subtitle = "Ordering is temporarily unavailable. Please try again later.";
    Icon = MdBlock;
  } else if (isOutsideHours) {
    const openTime = formatToAMPM(settings.operatingHours.open);
    title = "आज के लिए बंद";
    subtitle = `We're closed right now. We'll reopen at ${openTime}.`;
    Icon = MdSchedule;
  }

  return (
    <div className="fixed inset-0 bg-slate-950/70 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-100 flex flex-col items-center gap-4 text-center animate-in zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center">
          <Icon className="text-rose-500 text-3xl" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-900">{title}</h2>
          <p className="text-[13px] font-semibold text-slate-500 leading-relaxed">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
