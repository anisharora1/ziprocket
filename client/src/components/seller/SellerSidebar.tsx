'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { apiClient } from '../../services/api';
import OptimizedImage from '../OptimizedImage';

export default function SellerSidebar() {
  const pathname = usePathname();
  const [restaurant, setRestaurant] = useState<any>(null);

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const res = await apiClient.get('/restaurants/my-restaurant');
        if (res.data.success) {
          setRestaurant(res.data.restaurant);
        }
      } catch (err) {
        console.error("Failed to fetch restaurant profile", err);
      }
    };
    fetchRestaurant();
  }, []);

  const navLinks = [
    { name: 'Dashboard', href: '/seller/dashboard', icon: 'home' },
    { name: 'Orders', href: '/seller/orders', icon: 'receipt_long' },
    { name: 'Menu', href: '/seller/menu', icon: 'restaurant_menu' },
    { name: 'Finance', href: '/seller/finance', icon: 'payments' },
  ];

  return (
    <div className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col h-screen sticky top-0 shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-slate-100">
        <span className="text-xl font-black tracking-tight text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[24px]">restaurant</span>
          Kitchen OS
        </span>
      </div>

      <nav className="flex-1 py-6 px-4 flex flex-col gap-2">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-[14px] ${isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
            >
              <span className={`material-symbols-outlined ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                {link.icon}
              </span>
              {link.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100 bg-slate-50/50 m-4 rounded-2xl">
        {restaurant ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shrink-0 border border-slate-200 shadow-sm">
              {restaurant.image ? (
                <OptimizedImage src={restaurant.image} alt={restaurant.name} preset="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[18px]">
                  {restaurant.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-slate-900 truncate">{restaurant.name}</p>
              <p className="text-[11px] text-slate-500 truncate capitalize">{restaurant.category || "Restaurant"}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0"></div>
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-slate-200 rounded w-3/4"></div>
              <div className="h-2 bg-slate-200 rounded w-1/2"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
