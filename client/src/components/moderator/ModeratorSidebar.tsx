"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useModeratorSidebar } from '@/context/ModeratorSidebarContext';
import { usePendingFoodOrders } from '@/hooks/useOrders';
import { useOrderSocket } from '@/hooks/useOrderSocket';
import { useQueryClient } from '@tanstack/react-query';
import {
  MdShoppingBag,
  MdDashboard,
  MdLocalShipping,
  MdGroups,
  MdStorefront,
  MdCategory,
  MdAdminPanelSettings,
  MdClose,
  MdChevronLeft,
  MdChevronRight,
  MdRestaurant,
} from 'react-icons/md';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: MdDashboard,
  local_shipping: MdLocalShipping,
  restaurant: MdRestaurant,
  groups: MdGroups,
  storefront: MdStorefront,
  category: MdCategory,
};

export default function ModeratorSidebar() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const {
    isCollapsed,
    isMobileOpen,
    toggleDesktopSidebar,
    closeMobileSidebar,
  } = useModeratorSidebar();

  const { data: pendingFoodData } = usePendingFoodOrders();
  const pendingFoodCount = pendingFoodData?.count ?? (pendingFoodData?.orders?.length || 0);

  // Sync socket events for badge counter
  useOrderSocket({
    onNewOrder: (data) => {
      if (data?.orderType === 'food' || data?.order?.orderType === 'food') {
        queryClient.invalidateQueries({ queryKey: ['orders', 'pending-food'] });
      }
    },
    onOrderStatusUpdated: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders', 'pending-food'] });
    },
    onOrderCancelled: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders', 'pending-food'] });
    },
  });

  const navLinks = [
    { name: 'Dashboard', href: '/moderator/dashboard', iconKey: 'dashboard' },
    { name: 'Grocery Orders', href: '/moderator/orders', iconKey: 'local_shipping' },
    {
      name: 'Pending Food',
      href: '/moderator/food-orders',
      iconKey: 'restaurant',
      badge: pendingFoodCount > 0 ? pendingFoodCount : undefined,
    },
    { name: 'Zone Customers', href: '/moderator/users', iconKey: 'groups' },
    { name: 'Grocery Products', href: '/moderator/products', iconKey: 'storefront' },
    { name: 'Categories', href: '/moderator/categories', iconKey: 'category' },
  ];

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
              href="/moderator/dashboard"
              onClick={closeMobileSidebar}
              className="font-extrabold text-xl text-emerald-600 tracking-tight flex items-center gap-2"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                <MdShoppingBag className="text-[20px]" />
              </div>
              <span>ZipGrocery</span>
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
          <nav className="flex-1 py-4 flex flex-col gap-1.5 px-3.5 overflow-y-auto">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const IconComp = iconMap[link.iconKey];
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={closeMobileSidebar}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl relative font-bold text-[14px] transition-all duration-200 ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100/60'
                      : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-50'
                  }`}
                >
                  {IconComp && (
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                        isActive ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <IconComp className="text-[18px]" />
                    </div>
                  )}
                  <span>{link.name}</span>
                  {link.badge !== undefined && (
                    <span className="ml-auto px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500 text-white shadow-xs animate-pulse">
                      {link.badge}
                    </span>
                  )}
                  {isActive && !link.badge && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-emerald-600"></div>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Mobile Footer Moderator Info */}
          <div className="p-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
            <div className="bg-white border border-slate-200/70 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Logged in as</p>
              <div className="flex items-center gap-2 mb-2">
                <MdAdminPanelSettings className="text-[18px] text-emerald-600" />
                <span className="text-[13px] font-bold text-slate-800">Grocery Moderator</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)] animate-pulse"></div>
                <span className="text-[11px] font-semibold text-slate-500">Live Quick-Commerce</span>
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
              href="/moderator/dashboard"
              className="font-extrabold text-xl text-emerald-600 tracking-tight flex items-center gap-2.5 overflow-hidden whitespace-nowrap"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                <MdShoppingBag className="text-[20px]" />
              </div>
              <span className="text-[19px] text-slate-900 font-black">Zip<span className="text-emerald-600">Grocery</span></span>
            </Link>
          ) : (
            <Link
              href="/moderator/dashboard"
              title="ZipGrocery Moderator"
              className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 hover:scale-105 transition-transform"
            >
              <MdShoppingBag className="text-[22px]" />
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
              className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200/70 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 flex items-center justify-center transition-all active:scale-95"
              aria-label="Expand sidebar"
            >
              <MdChevronRight className="text-[18px]" />
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <nav className={`flex-1 py-4 flex flex-col gap-1.5 overflow-y-auto overflow-x-hidden ${
          isCollapsed ? 'px-2 items-center' : 'px-3.5'
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
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center relative transition-all duration-200 group ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'text-slate-500 hover:text-emerald-700 hover:bg-slate-50'
                  }`}
                >
                  {IconComp && (
                    <IconComp className={`text-[22px] transition-transform duration-200 group-hover:scale-110`} />
                  )}
                  {link.badge !== undefined && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white shadow-xs animate-pulse">
                      {link.badge > 99 ? '99+' : link.badge}
                    </span>
                  )}
                  {isActive && !link.badge && (
                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-600 rounded-l-full"></div>
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
                className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl relative font-bold text-[14px] transition-all duration-200 ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100/60'
                    : 'text-slate-500 hover:text-emerald-700 hover:bg-slate-50'
                }`}
              >
                {IconComp && (
                  <IconComp
                    className={`text-[20px] shrink-0 transition-transform duration-200 ${
                      isActive ? 'text-emerald-600 scale-110' : 'text-slate-400'
                    }`}
                  />
                )}
                <span className="truncate">{link.name}</span>
                {link.badge !== undefined && (
                  <span className="ml-auto px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500 text-white shadow-xs animate-pulse shrink-0">
                    {link.badge}
                  </span>
                )}
                {isActive && !link.badge && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-emerald-600 rounded-l-full"></div>
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
              title="Grocery Moderator • Inventory Portal Live"
              className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-emerald-600 relative group cursor-pointer"
            >
              <MdAdminPanelSettings className="text-[20px]" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(255,255,255,1)] animate-pulse"></span>
              
              <span className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                Moderator Console Active
              </span>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-100/90 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Logged in as</p>
              <div className="flex items-center gap-2 mb-2">
                <MdAdminPanelSettings className="text-[17px] text-emerald-600 shrink-0" />
                <span className="text-[12px] font-bold text-slate-700 truncate">Grocery Moderator</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)] animate-pulse shrink-0"></div>
                <span className="text-[11px] font-semibold text-slate-500 truncate">Inventory Portal Live</span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
