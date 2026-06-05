"use client";

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function BottomNavBar({ activeTab = "home" }: { activeTab?: "home" | "search" | "orders" | "profile" | "menu" }) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, token, logout } = useAuth();


  const isMenu = activeTab === "menu";
  const homeTabName = isMenu ? "Menu" : "Home";
  const homeTabIcon = isMenu ? "restaurant" : "home";
  const homeTabActive = activeTab === "home" || activeTab === "menu";

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-20 px-2 pb-safe bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] rounded-t-2xl md:hidden">
      {/* Home / Menu */}
      <Link
        href="/"
        className={`flex flex-col items-center justify-center rounded-xl px-3 py-1 transition-transform duration-200 active:scale-90 ${homeTabActive ? 'text-[#FF5C00] bg-[#FF5C00]/10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
      >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: homeTabActive ? "'FILL' 1" : "'FILL' 0" }}>{homeTabIcon}</span>
        <span className="font-sans text-[12px] font-semibold">{homeTabName}</span>
      </Link>

      {/* Search */}
      <Link
        href="/restaurants"
        className={`flex flex-col items-center justify-center rounded-xl px-3 py-1 transition-transform duration-200 active:scale-90 ${activeTab === 'search' ? 'text-[#FF5C00] bg-[#FF5C00]/10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
      >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'search' ? "'FILL' 1" : "'FILL' 0" }}>search</span>
        <span className="font-sans text-[12px] font-semibold">Search</span>
      </Link>

      {/* Orders */}
      <Link
        href="/orders"
        className={`flex flex-col items-center justify-center rounded-xl px-3 py-1 transition-transform duration-200 active:scale-90 ${activeTab === 'orders' ? 'text-[#FF5C00] bg-[#FF5C00]/10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
      >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'orders' ? "'FILL' 1" : "'FILL' 0" }}>receipt_long</span>
        <span className="font-sans text-[12px] font-semibold">Orders</span>
      </Link>

      {/* Profile */}
      {token && user ? (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className={`flex flex-col items-center justify-center rounded-xl px-3 py-1 transition-transform duration-200 active:scale-90 ${(activeTab === 'profile' || isProfileOpen) ? 'text-[#FF5C00] bg-[#FF5C00]/10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: (activeTab === 'profile' || isProfileOpen) ? "'FILL' 1" : "'FILL' 0" }}>person</span>
            <span className="font-sans text-[12px] font-semibold">Profile</span>
          </button>

          {/* Profile Dropdown Menu */}
          {isProfileOpen && (
            <div className="fixed bottom-24 left-4 right-4 bg-white rounded-3xl shadow-[0_-10px_40px_rgb(0,0,0,0.15)] border border-slate-100 overflow-hidden z-[100] transform transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
              <div className="max-h-[80vh] overflow-y-auto custom-scrollbar">
                {/* Header: Phone & Name */}
                <div className="p-5 border-b border-slate-50 bg-[#FF5C00]/5 sticky top-0 z-10 backdrop-blur-sm">
                  <p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">Logged in as</p>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-base font-black text-slate-900">{user.name || 'User'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="material-symbols-outlined text-[#FF5C00] text-[18px]">call</span>
                      <p className="text-sm font-bold text-slate-700">+91 {user.phone}</p>
                    </div>
                    <div className="mt-2 inline-block self-start px-2.5 py-0.5 bg-[#FF5C00]/10 text-[#FF5C00] text-[10px] font-extrabold rounded-md uppercase tracking-wider">
                      {user.role}
                    </div>
                  </div>
                </div>

                {/* Options */}
                <div className="p-2 space-y-1">
                  <Link href="/orders" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3.5 px-3 py-3 rounded-2xl hover:bg-slate-50 transition-colors text-slate-700 hover:text-[#FF5C00] group active:scale-[0.98]">
                    <div className="bg-slate-50 group-hover:bg-[#FF5C00]/10 w-10 h-10 rounded-full flex items-center justify-center transition-colors">
                      <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-[#FF5C00] transition-colors">receipt_long</span>
                    </div>
                    <span className="text-[14px] font-bold">My Orders</span>
                  </Link>

                  <Link href="/addresses" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3.5 px-3 py-3 rounded-2xl hover:bg-slate-50 transition-colors text-slate-700 hover:text-[#FF5C00] group active:scale-[0.98]">
                    <div className="bg-slate-50 group-hover:bg-[#FF5C00]/10 w-10 h-10 rounded-full flex items-center justify-center transition-colors">
                      <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-[#FF5C00] transition-colors">home_work</span>
                    </div>
                    <span className="text-[14px] font-bold">Saved Addresses</span>
                  </Link>

                  {user.role === 'customer' && (
                    <>
                      <Link href="/register-partner" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3.5 px-3 py-3 rounded-2xl hover:bg-slate-50 transition-colors text-slate-700 hover:text-[#FF5C00] group active:scale-[0.98]">
                        <div className="bg-slate-50 group-hover:bg-[#FF5C00]/10 w-10 h-10 rounded-full flex items-center justify-center transition-colors">
                          <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-[#FF5C00] transition-colors">storefront</span>
                        </div>
                        <span className="text-[14px] font-bold">Become Restaurant Partner</span>
                      </Link>
                      <Link href="/register-delivery" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3.5 px-3 py-3 rounded-2xl hover:bg-slate-50 transition-colors text-slate-700 hover:text-[#FF5C00] group active:scale-[0.98]">
                        <div className="bg-slate-50 group-hover:bg-[#FF5C00]/10 w-10 h-10 rounded-full flex items-center justify-center transition-colors">
                          <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-[#FF5C00] transition-colors">two_wheeler</span>
                        </div>
                        <span className="text-[14px] font-bold">Become Delivery Boy</span>
                      </Link>
                    </>
                  )}

                  {(user.role === 'seller' || user.role === 'delivery' || user.role === 'admin' || user.role === 'grocery_moderator') && (
                    <Link 
                      href={user.role === 'grocery_moderator' ? '/moderator/dashboard' : `/${user.role}/dashboard`}
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3.5 px-3 py-3 rounded-2xl hover:bg-slate-50 transition-colors text-slate-700 hover:text-[#FF5C00] group active:scale-[0.98]"
                    >
                      <div className="bg-slate-50 group-hover:bg-[#FF5C00]/10 w-10 h-10 rounded-full flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-[18px] text-[#FF5C00] transition-colors">dashboard</span>
                      </div>
                      <span className="text-[14px] font-bold">My Dashboard</span>
                    </Link>
                  )}
                </div>

                {/* Logout */}
                <div className="p-3 border-t border-slate-50 bg-slate-50/50 sticky bottom-0">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-white border border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors font-bold text-[14px] shadow-sm active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-[20px]">logout</span>
                    Logout
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Link
          href="/auth/login"
          className={`flex flex-col items-center justify-center rounded-xl px-3 py-1 transition-transform duration-200 active:scale-90 ${activeTab === 'profile' ? 'text-[#FF5C00] bg-[#FF5C00]/10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'profile' ? "'FILL' 1" : "'FILL' 0" }}>person</span>
          <span className="font-sans text-[12px] font-semibold">Login</span>
        </Link>
      )}
    </nav>
  );
}
