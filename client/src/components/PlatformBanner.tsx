"use client";

import React from "react";
import { usePlatform } from "@/context/PlatformContext";
import { MdEngineering, MdBlock, MdSchedule } from "react-icons/md";

const formatToAMPM = (timeStr: string): string => {
  if (!timeStr) return "8:00 AM";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  const displayM = m.toString().padStart(2, '0');
  return `${displayH}:${displayM} ${ampm}`;
};

export default function PlatformBanner() {
  const { settings, isPlatformCurrentlyOpen } = usePlatform();

  const isMaintenance = settings?.maintenanceMode ?? false;
  const isPlatformClosed = settings ? !settings.isPlatformOpen : false;
  const isOutsideHours = settings ? (!isPlatformCurrentlyOpen() && !isMaintenance && !isPlatformClosed) : false;

  // Determine if we need to show the banner
  const shouldShow = settings ? (isMaintenance || isPlatformClosed || isOutsideHours) : false;

  React.useEffect(() => {
    if (shouldShow) {
      document.body.classList.add("platform-banner-active");
    } else {
      document.body.classList.remove("platform-banner-active");
    }
    return () => {
      document.body.classList.remove("platform-banner-active");
    };
  }, [shouldShow]);

  if (!settings) return null;
  if (!shouldShow) return null;

  // Determine message and icon
  let message = "";
  let IconComponent = MdSchedule;

  if (isMaintenance) {
    message = "⚠️ We are currently performing maintenance. Ordering is temporarily unavailable.";
    IconComponent = MdEngineering;
  } else if (isPlatformClosed) {
    message = "⚠️ Ordering is currently unavailable. Please try again later.";
    IconComponent = MdBlock;
  } else if (isOutsideHours) {
    const openTime = formatToAMPM(settings.operatingHours.open);
    message = `⚠️ Orders are currently closed. We will reopen at ${openTime || "8:00 AM"}.`;
    IconComponent = MdSchedule;
  }

  return (
    <>
      <div
        className={`w-full text-center py-2.5 px-4 text-[13px] font-bold z-[100] flex items-center justify-center gap-2 border-b transition-all duration-300 shadow-sm animate-slideDown select-none shrink-0 ${isMaintenance || isPlatformClosed
          ? "bg-rose-50 border-rose-100 text-rose-700"
          : "bg-[#FFF1E6] border-[#FFE2CC] text-[#FF5C00]"
          }`}
      >
        <IconComponent className="text-[18px] shrink-0" />
        <span className="tracking-wide">{message}</span>
      </div>

      <style>{`
        body.platform-banner-active main {
          margin-top: 40px !important;
        }
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slideDown {
          animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </>
  );
}

