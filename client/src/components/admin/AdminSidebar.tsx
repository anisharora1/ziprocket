"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePlatform } from '@/context/PlatformContext';
import { useAdminSidebar } from '@/context/AdminSidebarContext';
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
  MdClose,
  MdChevronLeft,
  MdChevronRight,
  MdRocketLaunch,
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
  const { settings, isPlatformCurrentlyOpen } = usePlatform();
  const {
    isCollapsed,
    isMobileOpen,
    toggleDesktopSidebar,
    closeMobileSidebar,
  } = useAdminSidebar();

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
    <>
      {/* ======================================================== */}
      {/* 1. MOBILE DRAWER OVERLAY & BACKDROP (< lg screens)        */}
      {/* ======================================================== */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-visibility duration-300 ${
          isMobileOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
        }`}
        aria-hidden={!isMobileOpen}
      >
        {/* Dark Backdrop with fade transition */}
        <div
          onClick={closeMobileSidebar}
          className={`absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300 ease-in-out ${
            isMobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Mobile Slide-over Drawer with slide transition */}
        <aside
          className={`absolute top-0 bottom-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col z-10 transition-transform duration-300 ease-in-out transform ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Mobile Drawer Header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 shrink-0 bg-slate-50/50">
            <Link
              href="/admin/dashboard"
              onClick={closeMobileSidebar}
              className="font-extrabold text-xl text-primary tracking-tight flex items-center gap-2"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF5C00] to-[#E04F00] text-white flex items-center justify-center shadow-md shadow-orange-500/20">
                <MdRocketLaunch className="text-[20px]" />
              </div>
              <span className="text-[19px] font-black text-slate-900">Zip<span className="text-[#FF5C00]">Rocket</span></span>
            </Link>

            {/* Mobile Close Button */}
            <button
              onClick={closeMobileSidebar}
              className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors active:scale-95"
              aria-label="Close sidebar"
            >
              <MdClose className="text-[20px]" />
            </button>
          </div>

          {/* Mobile Navigation Links */}
          <nav className="flex-1 py-4 flex flex-col gap-1 px-3 overflow-y-auto">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const IconComp = iconMap[link.iconKey];
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={closeMobileSidebar}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl relative font-semibold text-[13px] transition-all duration-200 ${
                    isActive
                      ? 'bg-[#FF5C00]/10 text-[#FF5C00] shadow-xs'
                      : 'text-slate-600 hover:text-[#FF5C00] hover:bg-slate-50'
                  }`}
                >
                  {IconComp && (
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                        isActive ? 'bg-[#FF5C00] text-white shadow-xs' : 'text-slate-400'
                      }`}
                    >
                      <IconComp className="text-[17px]" />
                    </div>
                  )}
                  <span className="truncate">{link.name}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-4 bg-[#FF5C00] rounded-full"></div>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Mobile Footer System Status */}
          <div className="p-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">System Status</p>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${statusColor}`}></div>
                <span className="text-[12px] font-bold text-slate-700">{statusText}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ======================================================== */}
      {/* 2. DESKTOP COLLAPSIBLE SIDEBAR (lg: screens and above)     */}
      {/* ======================================================== */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-slate-200/80 sticky top-0 h-screen shrink-0 transition-all duration-300 ease-in-out z-30 select-none ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Desktop Sidebar Header */}
        <div className={`h-16 flex items-center border-b border-slate-100 shrink-0 transition-all duration-300 ${
          isCollapsed ? 'justify-center px-2' : 'justify-between px-5'
        }`}>
          {/* Logo & Title */}
          {!isCollapsed ? (
            <Link
              href="/admin/dashboard"
              className="font-extrabold text-xl tracking-tight flex items-center gap-2.5 overflow-hidden whitespace-nowrap"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF5C00] to-[#E04F00] text-white flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
                <MdRocketLaunch className="text-[20px]" />
              </div>
              <span className="text-[19px] font-black text-slate-900">Zip<span className="text-[#FF5C00]">Rocket</span></span>
            </Link>
          ) : (
            <Link
              href="/admin/dashboard"
              title="ZipRocket Admin"
              className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FF5C00] to-[#E04F00] text-white flex items-center justify-center shadow-md shadow-orange-500/20 hover:scale-105 transition-transform"
            >
              <MdRocketLaunch className="text-[22px]" />
            </Link>
          )}

          {/* Collapse/Expand Toggle Button on Desktop */}
          {!isCollapsed && (
            <button
              onClick={toggleDesktopSidebar}
              title="Collapse Sidebar"
              className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200/70 text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all active:scale-95"
              aria-label="Collapse sidebar"
            >
              <MdChevronLeft className="text-[18px]" />
            </button>
          )}
        </div>

        {/* Collapsed Expand Quick Button Header Banner */}
        {isCollapsed && (
          <div className="pt-2 px-2 flex justify-center shrink-0">
            <button
              onClick={toggleDesktopSidebar}
              title="Expand Sidebar"
              className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200/70 text-slate-400 hover:text-[#FF5C00] hover:bg-orange-50 hover:border-orange-200 flex items-center justify-center transition-all active:scale-95"
              aria-label="Expand sidebar"
            >
              <MdChevronRight className="text-[18px]" />
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <nav className={`flex-1 py-3 flex flex-col gap-1 overflow-y-auto overflow-x-hidden ${
          isCollapsed ? 'px-2 items-center' : 'px-3'
        }`}>
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const IconComp = iconMap[link.iconKey];

            if (isCollapsed) {
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  title={link.name}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center relative transition-all duration-200 group ${
                    isActive
                      ? 'bg-[#FF5C00] text-white shadow-md shadow-orange-500/20'
                      : 'text-slate-500 hover:text-[#FF5C00] hover:bg-slate-50'
                  }`}
                >
                  {IconComp && (
                    <IconComp className={`text-[20px] transition-transform duration-200 group-hover:scale-110`} />
                  )}
                  {isActive && (
                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#FF5C00] rounded-l-full"></div>
                  )}

                  {/* Floating tooltip on hover when collapsed */}
                  <span className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                    {link.name}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={link.name}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl relative font-semibold text-[13px] transition-all duration-200 ${
                  isActive
                    ? 'bg-[#FF5C00]/10 text-[#FF5C00] font-bold shadow-xs'
                    : 'text-slate-500 hover:text-[#FF5C00] hover:bg-slate-50'
                }`}
              >
                {IconComp && (
                  <IconComp
                    className={`text-[19px] shrink-0 transition-transform duration-200 ${
                      isActive ? 'text-[#FF5C00] scale-105' : 'text-slate-400'
                    }`}
                  />
                )}
                <span className="truncate">{link.name}</span>
                {isActive && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#FF5C00] rounded-l-full"></div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Sidebar Footer */}
        <div className={`border-t border-slate-100 shrink-0 ${
          isCollapsed ? 'p-2 flex flex-col items-center justify-center' : 'p-4'
        }`}>
          {isCollapsed ? (
            <div
              title={`System Status: ${statusText}`}
              className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-700 relative group cursor-pointer"
            >
              <div className={`w-2.5 h-2.5 rounded-full ${statusColor}`}></div>
              
              <span className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                System: {statusText}
              </span>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-100/90 rounded-2xl p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 leading-none">System Status</p>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${statusColor}`}></div>
                <span className="text-[12px] font-bold text-slate-700 truncate">{statusText}</span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
