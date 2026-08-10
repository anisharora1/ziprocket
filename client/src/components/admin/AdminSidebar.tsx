"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePlatform } from '@/context/PlatformContext';
import {
  MdDashboard,
  MdSettingsSuggest,
  MdApproval,
  MdMap,
  MdStorefront,
  MdDirectionsBike,
  MdShoppingCart,
  MdCampaign,
  MdPayments,
  MdLocalGroceryStore,
  MdAdminPanelSettings,
  MdAccountBalanceWallet,
} from 'react-icons/md';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: MdDashboard,
  settings_suggest: MdSettingsSuggest,
  approval: MdApproval,
  map: MdMap,
  storefront: MdStorefront,
  directions_bike: MdDirectionsBike,
  shopping_cart: MdShoppingCart,
  campaign: MdCampaign,
  payments: MdPayments,
  local_grocery_store: MdLocalGroceryStore,
  shield_person: MdAdminPanelSettings,
  account_balance_wallet: MdAccountBalanceWallet,
};

export default function AdminSidebar() {
  const pathname = usePathname();

  const navLinks = [
    { name: 'Dashboard', href: '/admin/dashboard', iconKey: 'dashboard' },
    { name: 'Platform Management', href: '/admin/platform', iconKey: 'settings_suggest' },
    { name: 'Applications', href: '/admin/applications', iconKey: 'approval' },
    { name: 'Delivery Zones', href: '/admin/zones', iconKey: 'map' },
    { name: 'Restaurants', href: '/admin/restaurants', iconKey: 'storefront' },
    { name: 'Personnel', href: '/admin/delivery', iconKey: 'directions_bike' },
    { name: 'Orders', href: '/admin/orders', iconKey: 'shopping_cart' },
    { name: 'Promotions', href: '/admin/promotions', iconKey: 'campaign' },
    { name: 'Coupons & Loyalty', href: '/admin/coupons', iconKey: 'payments' },
    { name: 'Grocery Audit', href: '/admin/grocery', iconKey: 'local_grocery_store' },
    { name: 'Grocery Moderators', href: '/admin/moderators', iconKey: 'shield_person' },
    { name: 'Finance & Settlements', href: '/admin/finance', iconKey: 'account_balance_wallet' },
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
          const IconComp = iconMap[link.iconKey];
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
              {IconComp && <IconComp className="text-[20px]" />}
              {link.name}
              {isActive && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-container rounded-l-full"></div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* System Status Footer */}
      {(() => {
        const { settings, isPlatformCurrentlyOpen } = usePlatform();
        let statusText = "Operational";
        let statusColor = "bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]";

        if (!settings) {
          statusText = "Loading...";
          statusColor = "bg-slate-300 animate-pulse";
        } else if (settings.maintenanceMode) {
          statusText = "Maintenance";
          statusColor = "bg-rose-500 shadow-[0_0_0_2px_rgba(244,63,94,0.2)]";
        } else if (!settings.isPlatformOpen || !isPlatformCurrentlyOpen()) {
          statusText = "Closed";
          statusColor = "bg-amber-500 shadow-[0_0_0_2px_rgba(245,158,11,0.2)]";
        }

        return (
          <div className="p-4 border-t border-slate-100 shrink-0">
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">System Status</p>
                <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${statusColor}`}></div>
                <span className="text-[12px] font-medium text-slate-700">{statusText}</span>
                </div>
            </div>
          </div>
        );
      })()}
    </aside>
  );
}

