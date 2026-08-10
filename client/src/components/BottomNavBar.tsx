"use client";

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePwa } from '@/context/PwaContext';
import {
  MdHome,
  MdRestaurant,
  MdSearch,
  MdReceiptLong,
  MdPerson,
  MdCall,
  MdHomeWork,
  MdStorefront,
  MdTwoWheeler,
  MdDashboard,
  MdBolt,
  MdLogout,
} from 'react-icons/md';

export default function BottomNavBar({ activeTab = "home" }: { activeTab?: "home" | "search" | "orders" | "profile" | "menu" }) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, token, logout } = useAuth();
  const { isInstalled, installApp, mounted } = usePwa();

  const isMenu = activeTab === "menu";
  const homeTabName = isMenu ? "Menu" : "Home";
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
        prefetch={false}
        className={`flex flex-col items-center justify-center rounded-xl px-3 py-1 transition-transform duration-200 active:scale-90 ${homeTabActive ? 'text-[#FF5C00] bg-[#FF5C00]/10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
      >
        {isMenu ? <MdRestaurant className="text-xl" /> : <MdHome className="text-xl" />}
        <span className="font-sans text-[12px] font-semibold">{homeTabName}</span>
      </Link>

      {/* Search */}
      <Link
        href="/restaurants"
        prefetch={false}
        className={`flex flex-col items-center justify-center rounded-xl px-3 py-1 transition-transform duration-200 active:scale-90 ${activeTab === 'search' ? 'text-[#FF5C00] bg-[#FF5C00]/10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
      >
        <MdSearch className="text-xl" />
        <span className="font-sans text-[12px] font-semibold">Search</span>
      </Link>

      {/* Orders */}
      <Link
        href="/orders"
        prefetch={false}
        className={`flex flex-col items-center justify-center rounded-xl px-3 py-1 transition-transform duration-200 active:scale-90 ${activeTab === 'orders' ? 'text-[#FF5C00] bg-[#FF5C00]/10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
      >
        <MdReceiptLong className="text-xl" />
        <span className="font-sans text-[12px] font-semibold">Orders</span>
      </Link>

      {/* Profile */}
      {token && user ? (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className={`flex flex-col items-center justify-center rounded-xl px-3 py-1 transition-transform duration-200 active:scale-90 ${(activeTab === 'profile' || isProfileOpen) ? 'text-[#FF5C00] bg-[#FF5C00]/10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
          >
            <MdPerson className="text-xl" />
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
                      <MdCall className="text-[#FF5C00] text-[18px]" />
                      <p className="text-sm font-bold text-slate-700">+91 {user.phone}</p>
                    </div>
                    <div className="mt-2 inline-block self-start px-2.5 py-0.5 bg-[#FF5C00]/10 text-[#FF5C00] text-[10px] font-extrabold rounded-md uppercase tracking-wider">
                      {user.role}
                    </div>
                  </div>
                </div>

                {/* Options */}
                <div className="p-2 space-y-1">
                  <Link href="/orders" prefetch={false} onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3.5 px-3 py-3 rounded-2xl hover:bg-slate-50 transition-colors text-slate-700 hover:text-[#FF5C00] group active:scale-[0.98]">
                    <div className="bg-slate-50 group-hover:bg-[#FF5C00]/10 w-10 h-10 rounded-full flex items-center justify-center transition-colors">
                      <MdReceiptLong className="text-[18px] text-slate-400 group-hover:text-[#FF5C00] transition-colors" />
                    </div>
                    <span className="text-[14px] font-bold">My Orders</span>
                  </Link>

                  <Link href="/addresses" prefetch={false} onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3.5 px-3 py-3 rounded-2xl hover:bg-slate-50 transition-colors text-slate-700 hover:text-[#FF5C00] group active:scale-[0.98]">
                    <div className="bg-slate-50 group-hover:bg-[#FF5C00]/10 w-10 h-10 rounded-full flex items-center justify-center transition-colors">
                      <MdHomeWork className="text-[18px] text-slate-400 group-hover:text-[#FF5C00] transition-colors" />
                    </div>
                    <span className="text-[14px] font-bold">Saved Addresses</span>
                  </Link>

                  {user.role === 'customer' && (
                    <>
                      <Link href="/register-partner" prefetch={false} onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3.5 px-3 py-3 rounded-2xl hover:bg-slate-50 transition-colors text-slate-700 hover:text-[#FF5C00] group active:scale-[0.98]">
                        <div className="bg-slate-50 group-hover:bg-[#FF5C00]/10 w-10 h-10 rounded-full flex items-center justify-center transition-colors">
                          <MdStorefront className="text-[18px] text-slate-400 group-hover:text-[#FF5C00] transition-colors" />
                        </div>
                        <span className="text-[14px] font-bold">Become Restaurant Partner</span>
                      </Link>
                      <Link href="/register-delivery" prefetch={false} onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3.5 px-3 py-3 rounded-2xl hover:bg-slate-50 transition-colors text-slate-700 hover:text-[#FF5C00] group active:scale-[0.98]">
                        <div className="bg-slate-50 group-hover:bg-[#FF5C00]/10 w-10 h-10 rounded-full flex items-center justify-center transition-colors">
                          <MdTwoWheeler className="text-[18px] text-slate-400 group-hover:text-[#FF5C00] transition-colors" />
                        </div>
                        <span className="text-[14px] font-bold">Become Delivery Boy</span>
                      </Link>
                    </>
                  )}

                  {(user.role === 'seller' || user.role === 'delivery' || user.role === 'admin' || user.role === 'grocery_moderator') && (
                    <Link 
                      href={user.role === 'grocery_moderator' ? '/moderator/dashboard' : `/${user.role}/dashboard`}
                      prefetch={false}
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3.5 px-3 py-3 rounded-2xl hover:bg-slate-50 transition-colors text-slate-700 hover:text-[#FF5C00] group active:scale-[0.98]"
                    >
                      <div className="bg-slate-50 group-hover:bg-[#FF5C00]/10 w-10 h-10 rounded-full flex items-center justify-center transition-colors">
                        <MdDashboard className="text-[18px] text-[#FF5C00] transition-colors" />
                      </div>
                      <span className="text-[14px] font-bold">My Dashboard</span>
                    </Link>
                  )}
                </div>

                {/* PWA Install Card */}
                {!isInstalled && mounted && (
                  <div className="mx-4 my-2 p-4 bg-[#FF5C00]/5 border border-[#FF5C00]/10 rounded-2xl flex flex-col gap-3">
                    <div className="flex gap-3 items-center">
                      <div className="bg-[#FF5C00]/15 text-[#FF5C00] p-2 rounded-xl flex items-center justify-center shrink-0">
                        <MdBolt className="text-[20px] font-bold" />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-black text-slate-900">Install ZipRocket App</span>
                        <span className="text-[10px] text-slate-500 font-semibold mt-0.5">तेज़ ऑर्डर और होम स्क्रीन एक्सेस</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        installApp();
                      }}
                      className="w-full py-2.5 bg-[#FF5C00] hover:bg-[#e05200] text-white text-xs font-extrabold rounded-xl transition-all active:scale-[0.97] shadow-sm shadow-[#FF5C00]/10"
                    >
                      Install App (इनस्टॉल करें)
                    </button>
                  </div>
                )}

                {/* Logout */}
                <div className="p-3 border-t border-slate-50 bg-slate-50/50 sticky bottom-0">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-white border border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors font-bold text-[14px] shadow-sm active:scale-[0.98]"
                  >
                    <MdLogout className="text-[20px]" />
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
          prefetch={false}
          className={`flex flex-col items-center justify-center rounded-xl px-3 py-1 transition-transform duration-200 active:scale-90 ${activeTab === 'profile' ? 'text-[#FF5C00] bg-[#FF5C00]/10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
        >
          <MdPerson className="text-xl" />
          <span className="font-sans text-[12px] font-semibold">Login</span>
        </Link>
      )}
    </nav>
  );
}

