'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function DeliveryBottomNav() {
  const pathname = usePathname();

  const navLinks = [
    { name: 'ORDERS', href: '/delivery/orders', icon: 'list_alt' },
    { name: 'MAP', href: '/delivery/dashboard', icon: 'directions_car' },
    { name: 'HISTORY', href: '/delivery/history', icon: 'history' },
    { name: 'EARNINGS', href: '/delivery/earnings', icon: 'payments' },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.02)] z-50">
      {navLinks.map((link) => {
        const isActive = pathname === link.href;

        if (isActive) {
          return (
            <Link
              key={link.name}
              href={link.href}
              className="flex flex-col items-center justify-center py-2 px-6 bg-[#10b981] text-white rounded-xl shadow-md transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">{link.icon}</span>
              <span className="text-[10px] font-bold mt-0.5 uppercase tracking-widest">{link.name}</span>
            </Link>
          );
        }

        return (
          <Link
            key={link.name}
            href={link.href}
            className="flex flex-col items-center justify-center p-2 rounded-xl px-4 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <span className="material-symbols-outlined text-[24px]">{link.icon}</span>
            <span className="text-[10px] font-bold mt-0.5 uppercase tracking-widest">{link.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
