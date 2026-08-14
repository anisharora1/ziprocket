"use client";

import { useAuth } from "@/context/AuthContext";
import { usePlatform } from "@/context/PlatformContext";
import { useAdminSidebar } from "@/context/AdminSidebarContext";
import { MdMenu, MdMenuOpen, MdLogout, MdShield } from "react-icons/md";

export default function AdminHeader() {
  const { user, logout } = useAuth();
  const { settings, isPlatformCurrentlyOpen } = usePlatform();
  const { toggleSidebar, isCollapsed } = useAdminSidebar();

  let statusText = "Operational";
  let statusBadgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200/60";
  let statusDotColor = "bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]";

  if (!settings) {
    statusText = "Loading...";
    statusBadgeColor = "bg-slate-50 text-slate-500 border-slate-200";
    statusDotColor = "bg-slate-300 animate-pulse";
  } else if (settings.maintenanceMode) {
    statusText = "Maintenance Mode";
    statusBadgeColor = "bg-rose-50 text-rose-700 border-rose-200";
    statusDotColor = "bg-rose-500 shadow-[0_0_0_2px_rgba(244,63,94,0.2)]";
  } else if (!settings.isPlatformOpen || !isPlatformCurrentlyOpen()) {
    statusText = "Platform Closed";
    statusBadgeColor = "bg-amber-50 text-amber-700 border-amber-200";
    statusDotColor = "bg-amber-500 shadow-[0_0_0_2px_rgba(245,158,11,0.2)]";
  }

  return (
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 md:px-8 shrink-0 sticky top-0 z-20 shadow-xs transition-all duration-300">
      {/* Left side: Hamburger / Sidebar toggle button & Title */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <button
          onClick={toggleSidebar}
          title="Toggle Sidebar"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 hover:text-[#FF5C00] hover:bg-orange-50 hover:border-orange-200/60 flex items-center justify-center transition-all duration-200 active:scale-95 shrink-0"
          aria-label="Toggle Sidebar"
        >
          {isCollapsed ? (
            <MdMenuOpen className="text-[22px]" />
          ) : (
            <MdMenu className="text-[22px]" />
          )}
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-[#FF5C00] rounded-full font-bold text-[11px] border border-orange-100/60 shrink-0">
            <MdShield className="text-[14px]" />
            <span>Admin</span>
          </div>
          <h1 className="font-extrabold text-slate-800 text-[14px] sm:text-[16px] truncate leading-tight">
            Platform Console
          </h1>
        </div>
      </div>

      {/* Right side: System Status Badge, Admin Profile & Sign Out */}
      <div className="flex items-center gap-3 shrink-0">
        <div className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold ${statusBadgeColor}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor}`}></span>
          <span>{statusText}</span>
        </div>

        <div className="text-right hidden sm:block">
          <p className="text-[12px] font-extrabold text-slate-800 leading-tight truncate max-w-[140px] md:max-w-[180px]">
            {user?.name || "System Admin"}
          </p>
          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
            {user?.phone || "Superuser"}
          </p>
        </div>

        <button
          onClick={logout}
          title="Sign Out"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-all duration-200 active:scale-95"
          aria-label="Sign Out"
        >
          <MdLogout className="text-[18px] sm:text-[20px]" />
        </button>
      </div>
    </header>
  );
}
