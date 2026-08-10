"use client";

import { useAuth } from "@/context/AuthContext";
import { MdSensors, MdLogout } from "react-icons/md";

interface ModeratorHeaderProps {
  title?: string;
}

export default function ModeratorHeader({ title = "Grocery Console" }: ModeratorHeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 sticky top-0 z-20 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full font-bold text-[12px] border border-emerald-100/50">
          <MdSensors className="text-[16px] animate-pulse" />
          Live
        </div>
        <h1 className="font-bold text-slate-800 text-[15px]">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[12px] font-bold text-slate-800">{user?.name || "Moderator"}</p>
            <p className="text-[10px] font-medium text-slate-400">{user?.phone || "+91 XXXXXXXXXX"}</p>
          </div>
          
          <button 
            onClick={logout}
            title="Log Out"
            className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-all duration-200"
          >
            <MdLogout className="text-[18px]" />
          </button>
        </div>
      </div>
    </header>
  );
}

