"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminSidebar() {
  const pathname = usePathname();

  const navLinks = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: 'dashboard' },
    { name: 'Applications', href: '/admin/applications', icon: 'approval' },
    { name: 'Delivery Zones', href: '/admin/zones', icon: 'map' },
    { name: 'Restaurants', href: '/admin/restaurants', icon: 'storefront' },
    { name: 'Personnel', href: '/admin/delivery', icon: 'directions_bike' },
    { name: 'Orders', href: '/admin/orders', icon: 'shopping_cart' },
    { name: 'Promotions', href: '/admin/promotions', icon: 'campaign' },
    { name: 'Coupons & Loyalty', href: '/admin/coupons', icon: 'payments' },
    { name: 'Grocery Audit', href: '/admin/grocery', icon: 'local_grocery_store' },
    { name: 'Grocery Moderators', href: '/admin/moderators', icon: 'shield_person' },
    { name: 'Finance & Settlements', href: '/admin/finance', icon: 'account_balance_wallet' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col sticky top-0 h-screen">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-slate-100 shrink-0">
        <span className="font-bold text-xl text-primary tracking-tight">ZipRocket</span>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 py-4 flex flex-col gap-1 px-3 overflow-y-auto">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link 
              key={link.name} 
              href={link.href} 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg relative font-medium text-[13px] transition-colors ${
                isActive 
                  ? 'bg-primary-container/10 text-primary-container' 
                  : 'text-slate-500 hover:text-primary hover:bg-primary-container/5'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{link.icon}</span>
              {link.name}
              {isActive && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-container rounded-l-full"></div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-4 border-t border-slate-100 shrink-0">
        <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">System Status</p>
            <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-tertiary-container shadow-[0_0_0_2px_rgba(85,164,84,0.2)]"></div>
            <span className="text-[12px] font-medium text-slate-700">Operational</span>
            </div>
        </div>
      </div>
    </aside>
  );
}
