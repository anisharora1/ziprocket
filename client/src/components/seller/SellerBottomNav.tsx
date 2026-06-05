'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SellerBottomNav() {
  const pathname = usePathname();

  const navLinks = [
    { name: 'Home', href: '/seller/dashboard', icon: 'home' },
    { name: 'Orders', href: '/seller/orders', icon: 'receipt_long' },
    { name: 'Menu', href: '/seller/menu', icon: 'restaurant_menu' },
    { name: 'Money', href: '/seller/finance', icon: 'payments' },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.02)] z-50">
      {navLinks.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.name}
            href={link.href}
            className={`flex flex-col items-center justify-center p-2 rounded-xl px-4 transition-colors ${
              isActive 
                ? 'text-emerald-600 bg-emerald-50' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">{link.icon}</span>
            <span className={`text-[10px] mt-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}>{link.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
