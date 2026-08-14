"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/api";
import ModeratorHeader from "@/components/moderator/ModeratorHeader";
import Link from "next/link";
import {
  MdAddCircle,
  MdExplore,
  MdLocationOn,
  MdInventory2,
  MdWarning,
  MdProductionQuantityLimits,
  MdPayments,
  MdLocalShipping,
  MdGroups,
  MdNotificationsActive,
  MdChevronRight,
  MdTaskAlt,
  MdImage,
  MdEditNote,
  MdTipsAndUpdates,
  MdCampaign,
  MdStorefront,
} from "react-icons/md";

interface InventoryStats {
  totalProducts: number;
  outOfStockProducts: number;
  lowStockProducts: number;
  totalValuation: number;
}

interface Product {
  _id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  stockQuantity: number;
  unit: string;
  images: string[];
}

export default function ModeratorDashboard() {
  const [stats, setStats] = useState<InventoryStats>({
    totalProducts: 0,
    outOfStockProducts: 0,
    lowStockProducts: 0,
    totalValuation: 0,
  });
  const [lowStockProductsList, setLowStockProductsList] = useState<Product[]>([]);
  const [ordersCount, setOrdersCount] = useState<number>(0);
  const [usersCount, setUsersCount] = useState<number>(0);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStockId, setUpdatingStockId] = useState<string | null>(null);
  const [quickStockVal, setQuickStockVal] = useState<number>(0);

  const fetchStatsAndProducts = async () => {
    try {
      const [statsRes, productsRes, ordersRes, usersRes, meRes] = await Promise.all([
        apiClient.get("/grocery/stats"),
        apiClient.get("/grocery?lowStock=true&limit=5"),
        apiClient.get("/orders/grocery"),
        apiClient.get("/orders/grocery/users"),
        apiClient.get("/auth/me")
      ]);
      
      if (statsRes.data.success) {
        setStats(statsRes.data.stats);
      }
      
      if (productsRes.data.success) {
        setLowStockProductsList(productsRes.data.products);
      }

      if (ordersRes.data.success) {
        setOrdersCount(ordersRes.data.count || ordersRes.data.orders?.length || 0);
      }

      if (usersRes.data.success) {
        setUsersCount(usersRes.data.count || usersRes.data.users?.length || 0);
      }

      if (meRes.data.success) {
        setProfile(meRes.data.user);
      }
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndProducts();
  }, []);

  const handleQuickStockUpdate = async (productId: string) => {
    try {
      setUpdatingStockId(productId);
      const res = await apiClient.put(`/grocery/${productId}`, {
        stockQuantity: quickStockVal
      });
      if (res.data.success) {
        // Refresh
        await fetchStatsAndProducts();
        setUpdatingStockId(null);
      }
    } catch (error) {
      console.error("Failed to update stock quick:", error);
      alert("Failed to update stock quantity. Please try again.");
      setUpdatingStockId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <ModeratorHeader title="Real-time Inventory Console" />
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            <p className="text-sm font-semibold text-slate-500">Loading catalog stats...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <ModeratorHeader title="Inventory Console" />
      
      <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 overflow-y-auto">
        {/* Welcome and action banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-3xl p-5 sm:p-6 md:p-8 shadow-xl shadow-emerald-950/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-white opacity-10 pointer-events-none"></div>
          <div className="relative z-10 space-y-1">
            <span className="inline-block px-3 py-1 bg-white/20 text-white font-bold text-[11px] rounded-full uppercase tracking-wider mb-2">
              Hyperlocal Quick-Commerce
            </span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">Grocery Control Room</h2>
            <p className="text-emerald-100 text-sm font-medium">
              Manage local catalog availability, categories, and urgent restock orders.
            </p>
          </div>
          <div className="relative z-10 flex gap-3">
            <Link 
              href="/moderator/products" 
              className="px-5 py-3 bg-white hover:bg-emerald-50 text-emerald-800 font-extrabold text-[13px] rounded-2xl shadow-md active:scale-95 transition-all flex items-center gap-2"
            >
              <MdAddCircle className="text-[18px]" />
              Manage Catalog
            </Link>
          </div>
        </div>

        {/* Moderator Assigned Zones Banner */}
        {profile?.assignedZones && profile.assignedZones.length > 0 && (
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <MdExplore className="text-[20px]" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Your Assigned Delivery Zones</h3>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {profile.assignedZones.map((zone: any) => (
                    <span 
                      key={zone._id} 
                      className="inline-flex items-center gap-0.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-100 font-extrabold text-[9px] rounded-lg uppercase tracking-wider"
                    >
                      <MdLocationOn className="text-[11px]" />
                      {zone.name} ({zone.radiusKm}km)
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="text-left sm:text-right shrink-0 bg-slate-50 p-3 rounded-2xl border border-slate-100 font-semibold text-xs text-slate-500">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Assigned Coverage</p>
              <p className="text-slate-850 font-bold leading-none mt-1">{profile.assignedZones.length} Active Zones</p>
            </div>
          </div>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6">
          {/* Total Products */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center transition-transform group-hover:scale-110">
                <MdInventory2 className="text-[24px]" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                Catalog Size
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-400 mb-1">Total Products</p>
              <h3 className="text-2xl font-black text-slate-900">{stats.totalProducts} items</h3>
            </div>
          </div>

          {/* Out of Stock */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between group">
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${stats.outOfStockProducts > 0 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
                <MdWarning className="text-[24px]" />
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${stats.outOfStockProducts > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                Stock Alert
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-400 mb-1">Out of Stock</p>
              <h3 className={`text-2xl font-black ${stats.outOfStockProducts > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {stats.outOfStockProducts} items
              </h3>
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between group">
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${stats.lowStockProducts > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
                <MdProductionQuantityLimits className="text-[24px]" />
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${stats.lowStockProducts > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                Needs Restock
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-400 mb-1">Low Stock (&lt;10)</p>
              <h3 className={`text-2xl font-black ${stats.lowStockProducts > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                {stats.lowStockProducts} items
              </h3>
            </div>
          </div>

          {/* Total Valuation */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center transition-transform group-hover:scale-110">
                <MdPayments className="text-[24px]" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                Asset Value
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-400 mb-1">Valuation</p>
              <h3 className="text-2xl font-black text-slate-900">
                ₹{stats.totalValuation?.toLocaleString()}
              </h3>
            </div>
          </div>

          {/* Zone Orders */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-650 flex items-center justify-center transition-transform group-hover:scale-110">
                <MdLocalShipping className="text-[24px]" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                Operations
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-400 mb-1">Zone Orders</p>
              <h3 className="text-2xl font-black text-slate-900">{ordersCount} orders</h3>
            </div>
          </div>

          {/* Zone Customers */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-655 flex items-center justify-center transition-transform group-hover:scale-110">
                <MdGroups className="text-[24px]" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                Audience
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-400 mb-1">Zone Users</p>
              <h3 className="text-2xl font-black text-slate-900">{usersCount} users</h3>
            </div>
          </div>
        </div>

        {/* Live Inventory Alert Dashboard desk */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Restock Widget */}
          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm lg:col-span-2 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-bold text-[16px] text-slate-800 flex items-center gap-2">
                  <MdNotificationsActive className="text-amber-500 text-[20px]" />
                  Urgent Restocking Desk
                </h3>
                <p className="text-xs text-slate-500 font-medium">Top low-stock items needing attention</p>
              </div>
              <Link 
                href="/moderator/products" 
                className="text-emerald-600 hover:text-emerald-700 font-bold text-[13px] flex items-center gap-1 transition-colors"
              >
                View Full Catalog
                <MdChevronRight className="text-[16px]" />
              </Link>
            </div>
            
            <div className="flex-1 p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/20">
                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Product Info</th>
                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Category</th>
                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Current Stock</th>
                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Quick Adjust</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lowStockProductsList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400 font-semibold text-sm">
                        <MdTaskAlt className="text-[48px] text-slate-200 block mb-2 mx-auto" />
                        All products are well stocked!
                      </td>
                    </tr>
                  ) : (
                    lowStockProductsList.map((product) => (
                      <tr key={product._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200/50 flex items-center justify-center">
                              {product.images && product.images[0] ? (
                                <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <MdImage className="text-slate-400 text-[20px]" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800 line-clamp-1">{product.name}</p>
                              <p className="text-[11px] font-semibold text-slate-400">{product.brand || "Local Brand"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-sm font-bold text-slate-600">
                          {product.category}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black ${product.stockQuantity === 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${product.stockQuantity === 0 ? 'bg-red-500' : 'bg-amber-500 animate-pulse'}`}></span>
                            {product.stockQuantity} {product.unit}s
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {updatingStockId === product._id ? (
                            <div className="flex items-center justify-center gap-2">
                              <input 
                                type="number" 
                                className="w-16 px-2 py-1 text-xs font-bold text-center border-2 border-emerald-500 rounded-lg focus:outline-none"
                                defaultValue={product.stockQuantity}
                                onChange={(e) => setQuickStockVal(Number(e.target.value))}
                                autoFocus
                              />
                              <button 
                                onClick={() => handleQuickStockUpdate(product._id)}
                                className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
                              >
                                Save
                              </button>
                              <button 
                                onClick={() => setUpdatingStockId(null)}
                                className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-200"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-center">
                              <button 
                                onClick={() => {
                                  setUpdatingStockId(product._id);
                                  setQuickStockVal(product.stockQuantity);
                                }}
                                className="px-3.5 py-1.5 bg-slate-50 border border-slate-200/60 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 font-bold text-[12px] rounded-xl transition-all flex items-center gap-1"
                              >
                                <MdEditNote className="text-[16px]" />
                                Restock
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Commerce Statistics */}
          <div className="flex flex-col gap-6">
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
              <h3 className="font-bold text-[15px] text-slate-800 flex items-center gap-2">
                <MdTipsAndUpdates className="text-emerald-600 text-[20px]" />
                Moderation Insights
              </h3>
              
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 flex gap-3">
                  <MdLocalShipping className="text-emerald-600 mt-0.5 text-[20px] shrink-0" />
                  <div>
                    <h4 className="text-[12px] font-bold text-emerald-800">Hyperlocal Auto-Routing</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                      Your orders are automatically filtered and routed to your account from your assigned zones only. Workloads are dynamically balanced!
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex gap-3">
                  <MdCampaign className="text-slate-500 mt-0.5 text-[20px] shrink-0" />
                  <div>
                    <h4 className="text-[12px] font-bold text-slate-700">Add Promo Banners</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                      Use the Admin panel to configure Category Ads or Seasonal Offers (e.g., "Monsoon Special Beverages") for instant sales.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Box */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500 rounded-full blur-[40px] opacity-20"></div>
              <h3 className="font-bold text-[15px] mb-2 flex items-center gap-2">
                <MdStorefront className="text-emerald-400 text-[20px]" />
                Add New Inventory
              </h3>
              <p className="text-slate-300 text-xs font-semibold leading-relaxed mb-6">
                Instantly catalog a new grocery item into our database with customizable sizes, offer badges, and real-time stock levels.
              </p>
              <Link 
                href="/moderator/products?action=new"
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[13px] rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all text-center block"
              >
                + Add New Product
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
