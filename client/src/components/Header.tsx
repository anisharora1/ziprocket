'use client';
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "@/context/LocationContext";
import { useAuth } from "@/context/AuthContext";
import { usePwa } from "@/context/PwaContext";
import dynamic from "next/dynamic";
const LocationSelectorModal = dynamic(() => import("@/components/LocationSelectorModal"), {
  ssr: false,
});

import PlatformBanner from "@/components/PlatformBanner";

export default function Header() {
  const { address, isLoading } = useLocation();
  const { user, token, logout } = useAuth();
  const { isInstalled, installApp, mounted } = usePwa();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-sm fixed top-0 left-0 right-0 z-50 flex flex-col">
      <PlatformBanner />
      <div className="max-w-7xl mx-auto flex justify-between items-center w-full px-4 sm:px-6 lg:px-8 h-16">

        {/* Left Side: Logo/Location */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsLocationModalOpen(true)}>
          <span className="material-symbols-outlined text-[#FF5C00]">
            {isLoading ? 'hourglass_empty' : 'location_on'}
          </span>
          <div className="flex flex-col">
            <span className="font-['Plus_Jakarta_Sans'] text-base font-bold text-slate-900 dark:text-white">
              Deliver to
            </span>
            <span className="text-[12px] text-slate-500 truncate max-w-[150px]">
              {isLoading ? 'Locating...' : address || 'Select location'}
            </span>
          </div>
          <span className="material-symbols-outlined text-slate-400 text-sm">keyboard_arrow_down</span>
        </div>

        {/* Middle: Desktop Navigation (Hidden on mobile) */}
        <nav className="hidden md:flex items-center gap-8">
          <Link href="/" className="text-sm font-semibold text-[#FF5C00] transition-colors">
            Home
          </Link>
          <Link href="/restaurants" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
            Search
          </Link>
          <Link href="/orders" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
            Orders
          </Link>
        </nav>

        {/* Right Side: Profile / Login */}
        <div className="relative" ref={dropdownRef}>
          {token && user ? (
            <>
              <div 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-10 h-10 rounded-full bg-slate-100 border-2 border-slate-200 shadow-sm transition-all duration-200 active:scale-95 cursor-pointer hover:shadow-md flex items-center justify-center overflow-hidden"
              >
                <span className="material-symbols-outlined text-slate-500">person</span>
              </div>
              
              {/* Profile Dropdown */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-[100]">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-bold text-slate-900">{user.name || 'User'}</p>
                    <p className="text-xs font-medium text-slate-500">+91 {user.phone}</p>
                    <div className="mt-1 inline-block px-2 py-0.5 bg-[#FF5C00]/10 text-[#FF5C00] text-[10px] font-bold rounded-md uppercase tracking-wider">
                      {user.role}
                    </div>
                  </div>
                  
                  <div className="py-2">
                    <Link href="/orders" className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors">
                      <span className="material-symbols-outlined text-[18px] text-slate-400">receipt_long</span>
                      My Orders
                    </Link>
                    <Link href="/addresses" className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors">
                      <span className="material-symbols-outlined text-[18px] text-slate-400">home_work</span>
                      Saved Addresses
                    </Link>
                    
                    {user.role === 'customer' && (
                      <>
                        <div className="h-px bg-slate-100 my-2"></div>
                        <Link href="/register-partner" className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors">
                          <span className="material-symbols-outlined text-[18px] text-orange-500">storefront</span>
                          Become Restaurant Partner
                        </Link>
                        <Link href="/register-delivery" className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors">
                          <span className="material-symbols-outlined text-[18px] text-emerald-500">two_wheeler</span>
                          Become Delivery Boy
                        </Link>
                      </>
                    )}

                    {(user.role === 'seller' || user.role === 'delivery' || user.role === 'admin' || user.role === 'grocery_moderator') && (
                      <>
                        <div className="h-px bg-slate-100 my-2"></div>
                        <Link 
                          href={user.role === 'grocery_moderator' ? '/moderator/dashboard' : `/${user.role}/dashboard`}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px] text-[#FF5C00]">dashboard</span>
                          My Dashboard
                        </Link>
                      </>
                    )}
                  </div>
                  
                  {/* PWA Install Card */}
                  {!isInstalled && mounted && (
                    <div className="mx-3 my-2 p-3.5 bg-[#FF5C00]/5 border border-[#FF5C00]/10 rounded-2xl flex flex-col gap-2">
                      <div className="flex gap-2.5 items-center">
                        <div className="bg-[#FF5C00]/15 text-[#FF5C00] p-1.5 rounded-lg flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[18px] font-bold">bolt</span>
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="text-[11px] font-extrabold text-slate-850">Install ZipRocket</span>
                          <span className="text-[9px] text-slate-500 font-semibold leading-tight">Faster food delivery app</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          installApp();
                        }}
                        className="w-full py-2 bg-[#FF5C00] hover:bg-[#e05200] text-white text-[11px] font-extrabold rounded-xl transition-all active:scale-[0.97] shadow-sm shadow-[#FF5C00]/10"
                      >
                        Install App
                      </button>
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-2 pb-1">
                    <button 
                      onClick={() => {
                        setIsDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-50 text-sm font-semibold text-red-600 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">logout</span>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <Link href="/auth/login" className="px-5 py-2.5 bg-[#FF5C00] hover:bg-[#e05200] text-white text-sm font-bold rounded-xl transition-all active:scale-95 shadow-md shadow-[#FF5C00]/20">
              Login
            </Link>
          )}
        </div>

      </div>
      <LocationSelectorModal isOpen={isLocationModalOpen} onClose={() => setIsLocationModalOpen(false)} />
    </header>
  );
}
