"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/services/api";
import { 
  MdRefresh, 
  MdAddPhotoAlternate, 
  MdStars, 
  MdCampaign, 
  MdDelete, 
  MdLink, 
  MdCalendarToday, 
  MdTrendingUp 
} from "react-icons/md";

interface Restaurant {
  _id: string;
  name: string;
  phone: string;
  cuisines: string;
  ownerName: string;
}

interface Promotion {
  _id: string;
  restaurant?: Restaurant;
  targetType: "restaurant" | "grocery";
  category?: string;
  image: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

// Collection of default gorgeous quick commerce Unsplash images
const DEFAULT_BANNER_IMAGES = [
  { url: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800", name: "Fresh Produce Banner" },
  { url: "https://images.unsplash.com/photo-1506084868230-bb9d95c24759?auto=format&fit=crop&q=80&w=800", name: "Super Saver Grocery" },
  { url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=800", name: "Premium Pizza Deal" },
  { url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=800", name: "Hot Meals Banner" }
];

export default function PromotionsAdminPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states for creating standard banner
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerDesc, setBannerDesc] = useState("");
  const [bannerImage, setBannerImage] = useState(DEFAULT_BANNER_IMAGES[0].url);
  const [bannerTargetType, setBannerTargetType] = useState<"restaurant" | "grocery">("grocery");
  const [bannerCategory, setBannerCategory] = useState("/grocery");
  const [bannerStartDate, setBannerStartDate] = useState("");
  const [bannerEndDate, setBannerEndDate] = useState("");

  // Form states for promoting restaurant
  const [selectedRestId, setSelectedRestId] = useState("");
  const [promoBadge, setPromoBadge] = useState("Featured Choice");
  const [promoImage, setPromoImage] = useState(DEFAULT_BANNER_IMAGES[3].url);

  // Fetch all promotions and approved restaurants
  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch promotions
      const promoRes = await apiClient.get("/admin/promotions");
      if (promoRes.data.success) {
        setPromotions(promoRes.data.promotions || []);
      }
      
      // Fetch approved restaurants to populate dropdown
      const restRes = await apiClient.get("/restaurants?status=approved");
      if (restRes.data.success) {
        const approvedList = restRes.data.restaurants || [];
        setRestaurants(approvedList);
        if (approvedList.length > 0) {
          setSelectedRestId(approvedList[0]._id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch promotions page data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Dispatch standard banner creation
  const handleCreateBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerTitle || !bannerDesc) {
      alert("Please fill in Banner Title and Description.");
      return;
    }

    try {
      const payload = {
        title: bannerTitle,
        description: bannerDesc,
        image: bannerImage,
        targetType: bannerTargetType,
        category: bannerCategory,
        startDate: bannerStartDate || undefined,
        endDate: bannerEndDate || undefined
      };

      const res = await apiClient.post("/admin/promotions", payload);
      if (res.data.success) {
        alert("Banner published successfully!");
        setBannerTitle("");
        setBannerDesc("");
        // Refresh list
        fetchData();
      }
    } catch (err: any) {
      console.error("Failed to publish banner:", err);
      alert(err.response?.data?.message || "Failed to publish banner.");
    }
  };

  // Dispatch restaurant feature promotion
  const handlePromoteRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestId) {
      alert("Please select a restaurant to promote.");
      return;
    }

    const restaurant = restaurants.find(r => r._id === selectedRestId);
    if (!restaurant) return;

    try {
      const payload = {
        restaurant: selectedRestId,
        title: restaurant.name,
        description: `${promoBadge} • Special Promotion`,
        image: promoImage,
        targetType: "restaurant" as const,
        category: `/restaurant/${selectedRestId}`
      };

      const res = await apiClient.post("/admin/promotions", payload);
      if (res.data.success) {
        alert("Restaurant added to featured list successfully!");
        fetchData();
      }
    } catch (err: any) {
      console.error("Failed to promote restaurant:", err);
      alert(err.response?.data?.message || "Failed to promote restaurant.");
    }
  };

  // Toggle promotion status
  const handleToggleStatus = async (id: string, currentlyActive: boolean) => {
    try {
      const res = await apiClient.patch(`/admin/promotions/${id}/status`, {
        isActive: !currentlyActive
      });
      if (res.data.success) {
        setPromotions(promotions.map(p => p._id === id ? { ...p, isActive: !currentlyActive } : p));
      }
    } catch (err) {
      console.error("Failed to toggle promotion status:", err);
      alert("Failed to toggle promotion status.");
    }
  };

  // Delete promotion banner
  const handleDeletePromotion = async (id: string) => {
    if (!confirm("Are you sure you want to delete this promotion/banner permanently?")) {
      return;
    }

    try {
      const res = await apiClient.delete(`/admin/promotions/${id}`);
      if (res.data.success) {
        setPromotions(promotions.filter(p => p._id !== id));
      }
    } catch (err) {
      console.error("Failed to delete promotion:", err);
      alert("Failed to delete promotion.");
    }
  };

  const now = new Date();
  const activeCount = promotions.filter(p => p.isActive && new Date(p.startDate) <= now && new Date(p.endDate) >= now).length;
  const scheduledCount = promotions.filter(p => !p.isActive).length;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/30 flex flex-col min-w-0">
      
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="max-w-2xl">
          <h2 className="text-[28px] font-black text-slate-800 tracking-tight leading-none mb-3">Ads & Promotions Desk</h2>
          <p className="text-[13px] font-semibold text-slate-400 uppercase tracking-widest leading-none mt-2">
            Control platform visibility, publish offer banners, and feature premier restaurant choices
          </p>
        </div>
        <button 
          onClick={fetchData}
          className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[13px] font-bold hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-2 shadow-sm"
        >
          <MdRefresh className="text-[18px]" />
          Refresh Desk
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column Forms (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          
          {/* Add Banner Form */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-6">
              <MdAddPhotoAlternate className="text-[22px] text-slate-800" />
              <h3 className="font-black text-[17px] text-slate-800">Publish Promo Banner</h3>
            </div>
            
            <form onSubmit={handleCreateBanner} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Banner Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Summer Pasta Festival" 
                  value={bannerTitle} 
                  onChange={(e) => setBannerTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-[13px] font-bold text-slate-800 focus:outline-none focus:border-slate-800 transition-colors shadow-sm" 
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Banner Description</label>
                <input 
                  type="text" 
                  placeholder="e.g. Up to 40% Off on Premium Pizzas" 
                  value={bannerDesc} 
                  onChange={(e) => setBannerDesc(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-[13px] font-bold text-slate-800 focus:outline-none focus:border-slate-800 transition-colors shadow-sm" 
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Target Type</label>
                  <select 
                    value={bannerTargetType}
                    onChange={(e) => setBannerTargetType(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-[13px] font-bold text-slate-700 focus:outline-none focus:border-slate-800 shadow-sm transition-colors cursor-pointer"
                  >
                    <option value="grocery">Grocery (Quick Commerce)</option>
                    <option value="restaurant">Restaurant Partner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Category / Destination Link</label>
                  <input 
                    type="text" 
                    placeholder="e.g. /grocery" 
                    value={bannerCategory} 
                    onChange={(e) => setBannerCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-[13px] font-bold text-slate-800 focus:outline-none focus:border-slate-800 transition-colors shadow-sm" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Banner Graphics Template</label>
                <div className="grid grid-cols-2 gap-2">
                  {DEFAULT_BANNER_IMAGES.map((img) => (
                    <button
                      key={img.url}
                      type="button"
                      onClick={() => setBannerImage(img.url)}
                      className={`relative h-14 rounded-xl overflow-hidden border-2 transition-all ${
                        bannerImage === img.url ? "border-slate-850 scale-95 shadow" : "border-slate-100 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-1">
                        <span className="text-[9px] font-black text-white text-center line-clamp-1">{img.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Paste Custom Image URL (Optional)</label>
                <input 
                  type="text" 
                  value={bannerImage} 
                  onChange={(e) => setBannerImage(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-[12px] font-semibold text-slate-500 focus:outline-none focus:border-slate-800 transition-colors shadow-sm" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Start Date</label>
                  <input 
                    type="date" 
                    value={bannerStartDate} 
                    onChange={(e) => setBannerStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-[12px] font-bold text-slate-600 focus:outline-none focus:border-slate-800 transition-colors shadow-sm" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">End Date</label>
                  <input 
                    type="date" 
                    value={bannerEndDate} 
                    onChange={(e) => setBannerEndDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-[12px] font-bold text-slate-600 focus:outline-none focus:border-slate-800 transition-colors shadow-sm" 
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-[13px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm mt-2"
              >
                Publish Live Banner
              </button>
            </form>
          </div>

          {/* Promote Restaurant Form */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-6">
              <MdStars className="text-[22px] text-slate-800" />
              <h3 className="font-black text-[17px] text-slate-800">Promote Active Restaurant</h3>
            </div>
            
            <form onSubmit={handlePromoteRestaurant} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Select Restaurant Partner</label>
                {restaurants.length === 0 ? (
                  <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-xl">
                    No approved restaurants in database. Register and approve a restaurant first!
                  </p>
                ) : (
                  <select 
                    value={selectedRestId}
                    onChange={(e) => setSelectedRestId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-[13px] font-bold text-slate-700 focus:outline-none focus:border-slate-800 shadow-sm transition-colors cursor-pointer"
                  >
                    {restaurants.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name} ({r.cuisines ? r.cuisines.split(",")[0] : "General"})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Promotion Tag/Badge</label>
                  <select 
                    value={promoBadge}
                    onChange={(e) => setPromoBadge(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-[13px] font-bold text-slate-700 focus:outline-none focus:border-slate-800 shadow-sm transition-colors cursor-pointer"
                  >
                    <option value="Featured Choice">Featured Choice</option>
                    <option value="Top Rated Partner">Top Rated</option>
                    <option value="Free Delivery Offer">Free Delivery</option>
                    <option value="50% Off Super Saver">50% Off</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Featured Card Graphics</label>
                  <select 
                    value={promoImage}
                    onChange={(e) => setPromoImage(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-[13px] font-bold text-slate-700 focus:outline-none focus:border-slate-800 shadow-sm transition-colors cursor-pointer"
                  >
                    <option value={DEFAULT_BANNER_IMAGES[3].url}>Hot Meals Promo</option>
                    <option value={DEFAULT_BANNER_IMAGES[2].url}>Pizza Promo</option>
                    <option value={DEFAULT_BANNER_IMAGES[0].url}>Produce Promo</option>
                  </select>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={restaurants.length === 0}
                className="w-full py-3 bg-white border-2 border-slate-200 hover:border-slate-850 hover:bg-slate-50 text-slate-700 rounded-2xl text-[13px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm mt-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add to Featured Placement
              </button>
            </form>
          </div>
          
        </div>

        {/* Right Column Promotions Dashboard View (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Live Promotions List Container */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/20">
              <div>
                <h3 className="font-black text-[17px] text-slate-800 leading-none">Live Banners & Promotions</h3>
                <p className="text-[11px] font-bold text-slate-400 mt-2">Active advertisements running across grocery and food delivery portals</p>
              </div>
              <div className="flex gap-2">
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black tracking-widest uppercase rounded-full">
                  {activeCount} Active
                </span>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-black tracking-widest uppercase rounded-full">
                  {scheduledCount} Paused
                </span>
              </div>
            </div>
            
            <div className="flex flex-col divide-y divide-slate-100 min-h-[300px]">
              {loading ? (
                <div className="py-20 text-center text-slate-400 font-semibold text-xs my-auto">
                  <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-3"></div>
                  Loading live ads desk...
                </div>
              ) : promotions.length === 0 ? (
                <div className="py-20 text-center text-slate-400 font-bold text-xs my-auto flex flex-col items-center justify-center">
                  <MdCampaign className="text-[40px] text-slate-200 mb-2" />
                  No promotional placements or active banners found in database.
                </div>
              ) : (
                promotions.map((promo) => {
                  return (
                    <div key={promo._id} className="p-6 flex flex-col sm:flex-row gap-4 hover:bg-slate-50/30 transition-colors group">
                      
                      {/* Graphics Thumb */}
                      <div className="w-24 h-16 bg-slate-100 rounded-xl overflow-hidden shrink-0 border border-slate-250/50 shadow-sm">
                        <img 
                          src={promo.image || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200"} 
                          alt={promo.title} 
                          className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                        />
                      </div>
                      
                      {/* Promo Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-4 mb-1">
                          <h4 className="font-black text-[15px] text-slate-800 leading-snug line-clamp-1">{promo.title}</h4>
                          
                          <div className="flex items-center gap-2">
                            {/* Toggle active switch */}
                            <button
                              onClick={() => handleToggleStatus(promo._id, promo.isActive)}
                              className={`w-9 h-5 rounded-full relative transition-colors ${
                                promo.isActive ? "bg-slate-800" : "bg-slate-200"
                              }`}
                              title={promo.isActive ? "Pause Promotion" : "Activate Promotion"}
                            >
                              <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all ${
                                promo.isActive ? "right-1" : "left-1"
                              }`} />
                            </button>

                            {/* Delete button */}
                            <button
                              onClick={() => handleDeletePromotion(promo._id)}
                              className="p-1 hover:bg-rose-50 text-slate-300 hover:text-rose-600 rounded-lg transition-colors"
                              title="Delete Promotion"
                            >
                              <MdDelete className="text-[16px]" />
                            </button>
                          </div>
                        </div>

                        <p className="text-[12px] font-semibold text-slate-500 mb-2 leading-relaxed line-clamp-1">
                          {promo.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-[10px] font-bold text-slate-400 tracking-wide uppercase">
                          <span className="flex items-center gap-1 shrink-0">
                            <MdLink className="text-[13px] text-slate-350" /> 
                            {promo.category || "/"}
                          </span>
                          
                          {promo.startDate && (
                            <span className="flex items-center gap-1 shrink-0">
                              <MdCalendarToday className="text-[13px] text-slate-350" /> 
                              {new Date(promo.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} 
                              {" - "}
                              {new Date(promo.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-3">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase ${
                            promo.targetType === "restaurant" 
                              ? "bg-purple-50 text-purple-700 border border-purple-100" 
                              : "bg-blue-50 text-blue-700 border border-blue-100"
                          }`}>
                            {promo.targetType}
                          </span>
                          {new Date(promo.endDate) < new Date() ? (
                            <span className="px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase bg-rose-50 text-rose-600 border border-rose-200">
                              Expired
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-400">
                              Live Placement
                            </span>
                          )}
                        </div>

                      </div>

                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-slate-100 text-center bg-slate-50/50 text-[12px] font-bold text-slate-500">
              Showing {promotions.length} total platform promotions
            </div>
          </div>

          {/* Dynamic Stats Cards */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-2">Currently Live</p>
              <h3 className="text-3xl font-black text-slate-800 mb-2 leading-none">{activeCount}</h3>
              <p className="text-[11px] font-bold text-slate-400">Showing on the platform right now</p>
            </div>
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-2">Expired, Still Marked Active</p>
              <h3 className="text-3xl font-black text-amber-600 mb-2 leading-none">
                {promotions.filter(p => p.isActive && new Date(p.endDate) < new Date()).length}
              </h3>
              <p className="text-[11px] font-bold text-slate-400">Past end date — won't show publicly, but worth cleaning up</p>
            </div>
          </div>

        </div>
      </div>
      
    </div>
  );
}
