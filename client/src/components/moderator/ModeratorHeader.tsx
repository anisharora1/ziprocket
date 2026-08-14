"use client";

import { useAuth } from "@/context/AuthContext";
import { useModeratorSidebar } from "@/context/ModeratorSidebarContext";
import { MdSensors, MdLogout, MdMenu, MdMenuOpen } from "react-icons/md";

interface ModeratorHeaderProps {
  title?: string;
}

export default function ModeratorHeader({ title = "Grocery Console" }: ModeratorHeaderProps) {
  const { user, logout } = useAuth();
  const { toggleSidebar, isCollapsed } = useModeratorSidebar();

  return (
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 md:px-8 shrink-0 sticky top-0 z-20 shadow-xs transition-all duration-300">
      {/* Left side: Hamburger/Sidebar toggle button & Title */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <button
          onClick={toggleSidebar}
          title="Toggle Sidebar"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200/60 flex items-center justify-center transition-all duration-200 active:scale-95 shrink-0"
          aria-label="Toggle Sidebar"
        >
          {isCollapsed ? (
            <MdMenuOpen className="text-[22px]" />
          ) : (
            <MdMenu className="text-[22px]" />
          )}
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full font-bold text-[11px] border border-emerald-100/60 shrink-0">
            <MdSensors className="text-[14px] animate-pulse" />
            <span>Live</span>
          </div>
          <h1 className="font-extrabold text-slate-800 text-[14px] sm:text-[16px] truncate leading-tight">
            {title}
          </h1>
        </div>
      </div>

      {/* Right side: Moderator Profile Info & Logout */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-[12px] font-extrabold text-slate-800 leading-tight truncate max-w-[140px] md:max-w-[200px]">
            {user?.name || "Grocery Moderator"}
          </p>
          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
            {user?.phone || "Staff Access"}
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
