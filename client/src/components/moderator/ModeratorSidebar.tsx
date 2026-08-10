"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MdShoppingBag,
  MdDashboard,
  MdLocalShipping,
  MdGroups,
  MdStorefront,
  MdCategory,
  MdAdminPanelSettings,
} from 'react-icons/md';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: MdDashboard,
  local_shipping: MdLocalShipping,
  groups: MdGroups,
  storefront: MdStorefront,
  category: MdCategory,
};

export default function ModeratorSidebar() {
  const pathname = usePathname();

  const navLinks = [
    { name: 'Dashboard', href: '/moderator/dashboard', iconKey: 'dashboard' },
    { name: 'Grocery Orders', href: '/moderator/orders', iconKey: 'local_shipping' },
    { name: 'Zone Customers', href: '/moderator/users', iconKey: 'groups' },
    { name: 'Grocery Products', href: '/moderator/products', iconKey: 'storefront' },
    { name: 'Categories', href: '/moderator/categories', iconKey: 'category' }
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col sticky top-0 h-screen">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-slate-100 shrink-0">
        <span className="font-extrabold text-xl text-emerald-600 tracking-tight flex items-center gap-2">
          <MdShoppingBag className="text-[24px]" />
          ZipGrocery
        </span>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 py-4 flex flex-col gap-1 px-3 overflow-y-auto">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          const IconComp = iconMap[link.iconKey];
          return (
            <Link 
              key={link.name} 
              href={link.href} 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl relative font-semibold text-[14px] transition-all duration-200 ${
                isActive 
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100/50' 
                  : 'text-slate-500 hover:text-emerald-600 hover:bg-slate-50'
              }`}
            >
              {IconComp && (
                <IconComp className={`text-[20px] transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
              )}
              {link.name}
              {isActive && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-600 rounded-l-full"></div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Moderator Role Info & Status Footer */}
      <div className="p-4 border-t border-slate-100 shrink-0">
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Logged in as</p>
            <div className="flex items-center gap-2 mb-3">
              <MdAdminPanelSettings className="text-[16px] text-emerald-600" />
              <span className="text-[12px] font-bold text-slate-700">Grocery Moderator</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)] animate-pulse"></div>
              <span className="text-[11px] font-semibold text-slate-500">Inventory Portal Live</span>
            </div>
        </div>
      </div>
    </aside>
  );
}

