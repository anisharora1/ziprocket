'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MdListAlt,
  MdDirectionsCar,
  MdHistory,
  MdPayments,
} from 'react-icons/md';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  list_alt: MdListAlt,
  directions_car: MdDirectionsCar,
  history: MdHistory,
  payments: MdPayments,
};

export default function DeliveryBottomNav() {
  const pathname = usePathname();

  const navLinks = [
    { name: 'ORDERS', href: '/delivery/orders', iconKey: 'list_alt' },
    { name: 'MAP', href: '/delivery/dashboard', iconKey: 'directions_car' },
    { name: 'HISTORY', href: '/delivery/history', iconKey: 'history' },
    { name: 'EARNINGS', href: '/delivery/earnings', iconKey: 'payments' },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.02)] z-50">
      {navLinks.map((link) => {
        const isActive = pathname === link.href;
        const IconComp = iconMap[link.iconKey];

        if (isActive) {
          return (
            <Link
              key={link.name}
              href={link.href}
              className="flex flex-col items-center justify-center py-2 px-6 bg-[#10b981] text-white rounded-xl shadow-md transition-colors"
            >
              {IconComp && <IconComp className="text-[24px]" />}
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
            {IconComp && <IconComp className="text-[24px]" />}
            <span className="text-[10px] font-bold mt-0.5 uppercase tracking-widest">{link.name}</span>
          </Link>
        );
      })}
    </div>
  );
}

