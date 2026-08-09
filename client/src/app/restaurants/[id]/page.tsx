"use client";
import Link from "next/link";
import BottomNavBar from "@/components/BottomNavBar";
import FloatingCartButton from "@/components/FloatingCartButton";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { apiClient } from "@/services/api";
import { useCart } from "@/context/CartContext";
import OptimizedImage from "@/components/OptimizedImage";
import { usePlatform } from "@/context/PlatformContext";
import PlatformBanner from "@/components/PlatformBanner";

export default function RestaurantMenuPage() {
  const { id } = useParams();
  const router = useRouter();
  const { addToCart } = useCart();
  const { settings, isPlatformCurrentlyOpen, getPlatformStatusMessage } = usePlatform();
  
  const [restaurant, setRestaurant] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      console.log(`[Restaurant Details] Loading ID: ${id}`);
      
      try {
        // Fetch restaurant details
        try {
          const restRes = await apiClient.get(`/restaurants/${id}`);
          if (restRes.data.success) {
            setRestaurant(restRes.data.restaurant);
          } else {
            console.warn("[Restaurant Details] API success is false:", restRes.data);
          }
        } catch (restErr: any) {
          console.error("[Restaurant Details] Failed to fetch restaurant info:", restErr.message || restErr);
        }

        // Fetch menu items independently
        try {
          const menuRes = await apiClient.get(`/restaurants/${id}/menu`);
          if (menuRes.data.success) {
            setMenuItems(menuRes.data.menuItems || []);
          } else {
            console.warn("[Restaurant Details] Menu API success is false:", menuRes.data);
          }
        } catch (menuErr: any) {
          console.error("[Restaurant Details] Failed to fetch menu items:", menuErr.message || menuErr);
        }
      } catch (err) {
        console.error("[Restaurant Details] Unexpected error in fetchData:", err);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id]);

  const categories = Array.from(new Set((menuItems || []).map(item => item.category).filter(Boolean)));
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const scrollToCategory = (category: string) => {
    setActiveCategory(category);
    if (category === "All") {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const element = document.getElementById(`category-${category}`);
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 180;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] w-full flex flex-col">
        <div className="h-16 bg-white shadow-sm mb-4 animate-pulse"></div>
        <div className="mx-4 h-32 bg-slate-200 rounded-2xl mb-6 animate-pulse"></div>
        <div className="flex gap-3 px-4 mb-6">
          <div className="h-10 w-24 bg-slate-200 rounded-full animate-pulse"></div>
          <div className="h-10 w-24 bg-slate-200 rounded-full animate-pulse"></div>
          <div className="h-10 w-24 bg-slate-200 rounded-full animate-pulse"></div>
        </div>
        <div className="px-4 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 bg-white rounded-2xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-4xl text-slate-400">store_off</span>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Restaurant Unavailable</h2>
        <p className="text-slate-500 mb-6">We couldn't find the restaurant you're looking for.</p>
        <Link href="/" className="px-6 py-3 bg-[#a73a00] text-white font-bold rounded-xl shadow-md">
          Back to Home
        </Link>
      </div>
    );
  }

  // Group menu items by category
  const groupedItems = (menuItems || []).reduce((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="bg-[#f8f9fa] text-on-surface pb-32 min-h-screen w-full font-sans">
      <PlatformBanner />
      {/* Top AppBar */}
      <header className="bg-[#fef9f4] sticky top-0 z-40 pt-4 pb-3 px-4 flex items-center justify-between">
        <Link href="/" className="w-10 h-10 flex items-center justify-center transition-transform active:scale-95 bg-white rounded-full shadow-sm">
          <span className="material-symbols-outlined text-[#a73a00]">arrow_back</span>
        </Link>
        <h1 className="font-bold text-lg text-[#5a2000] truncate px-2">{restaurant.name}</h1>
        <button className="w-10 h-10 flex items-center justify-center transition-transform active:scale-95 shrink-0 bg-white rounded-full shadow-sm">
          <span className="material-symbols-outlined text-[#a73a00]">favorite_border</span>
        </button>
      </header>

      {/* Restaurant Info Header */}
      <div className="bg-[#fef9f4] px-4 pb-6 rounded-b-3xl shadow-sm">
        <div className="flex gap-3 justify-center mb-4">
          <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#faeddf] border border-[#f3dcb8]">
            <span className="material-symbols-outlined text-[14px] text-[#a73a00]">star</span>
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-bold text-[#a73a00] leading-none">{restaurant.rating > 0 ? restaurant.rating : "New"}</span>
              <span className="text-[9px] text-[#a73a00] leading-none">Rating</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#e8f0f4] border border-[#d2e2eb]">
            <span className="material-symbols-outlined text-[14px] text-slate-500">store</span>
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-bold text-slate-700 leading-none">{restaurant.totalOrders || 0}</span>
              <span className="text-[9px] text-slate-500 leading-none">Orders</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#e8f0f4] border border-[#d2e2eb]">
            <span className="material-symbols-outlined text-[14px] text-slate-500">info</span>
            <div className="flex flex-col items-center">
              <span className={`text-[11px] font-bold leading-none ${
                settings?.maintenanceMode
                  ? 'text-rose-600'
                  : restaurant.availabilityStatus === "open"
                  ? 'text-emerald-600'
                  : 'text-red-500'
              }`}>
                {settings?.maintenanceMode
                  ? 'MAINTENANCE'
                  : restaurant.availabilityStatus === "open"
                  ? 'OPEN'
                  : restaurant.availabilityStatus === "disabled"
                  ? 'DISABLED'
                  : 'CLOSED'}
              </span>
              <span className="text-[9px] text-slate-500 leading-none">Status</span>
            </div>
          </div>
        </div>
        <p className="text-[13px] text-[#5a3a2a] text-center leading-relaxed px-2">
          {restaurant.location?.address || "Address not provided"}
        </p>
      </div>

      {/* Platform / Restaurant Status Warning Banner */}
      {(() => {
        const platformMsg = getPlatformStatusMessage();
        const isRestaurantOpen = restaurant && restaurant.availabilityStatus === "open";
        const isOrderingDisabled = !!platformMsg || !isRestaurantOpen;

        if (!isOrderingDisabled) return null;

        return (
          <div className="mx-4 mt-4 bg-[#FFF5F5] border border-[#FFE2E2] rounded-2xl p-4 flex items-start gap-3 shadow-sm">
            <span className="material-symbols-outlined text-rose-500 shrink-0 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {settings?.maintenanceMode ? "engineering" : "error"}
            </span>
            <div className="space-y-1">
              <h4 className="text-[13px] font-bold text-rose-800">
                {settings?.maintenanceMode 
                  ? "Platform Maintenance" 
                  : !isPlatformCurrentlyOpen() 
                  ? "Ordering Closed" 
                  : "Restaurant Unavailable"}
              </h4>
              <p className="text-[12px] text-rose-600 leading-relaxed font-semibold">
                {platformMsg || (restaurant?.availabilityStatus === "disabled" 
                  ? "This restaurant is temporarily disabled by platform administration." 
                  : "This restaurant is currently closed and not accepting new orders.")}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Sticky Categories Navigation */}
      {categories.length > 0 && (
        <div className="sticky top-[68px] z-30 bg-[#f8f9fa]/95 backdrop-blur-sm py-3 px-4 border-b border-slate-200">
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
            <button 
              onClick={() => scrollToCategory("All")}
              className={`px-5 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all shadow-sm ${
                activeCategory === "All" 
                  ? "bg-[#a73a00] text-white scale-105" 
                  : "bg-white text-slate-600 border border-slate-200"
              }`}
            >
              All
            </button>
            {categories.map((cat: any) => (
              <button 
                key={cat}
                onClick={() => scrollToCategory(cat)}
                className={`px-5 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all shadow-sm ${
                  activeCategory === cat 
                    ? "bg-[#a73a00] text-white scale-105" 
                    : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu Items List */}
      <main className="px-4 py-5 space-y-8">
        {(!menuItems || menuItems.length === 0) ? (
          <div className="text-center py-16 flex flex-col items-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl text-slate-300">restaurant_menu</span>
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-1">No Menu Items</h3>
            <p className="text-sm text-slate-500">This restaurant hasn't added any items yet.</p>
          </div>
        ) : (
          categories.map((category: any) => (
            <div key={`category-${category}`} id={`category-${category}`} className="scroll-mt-36">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                {category}
                <span className="text-[12px] font-medium px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full">
                  {groupedItems[category]?.length || 0}
                </span>
              </h2>
              <div className="space-y-5">
                {(groupedItems[category] || []).map((item: any) => (
                  <div key={item._id} className={`bg-white rounded-2xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-slate-100 ${!item.isAvailable ? 'opacity-70' : ''}`}>
                    <div className="h-48 w-full relative bg-slate-100">
                      <OptimizedImage 
                        className={`w-full h-full object-cover ${!item.isAvailable ? 'grayscale' : ''}`}
                        src={(item.images && item.images[0]) || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800"} 
                        alt={item.name}
                        preset="card"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800";
                        }}
                      />
                      {!item.isAvailable && (
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <span className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-slate-800 uppercase tracking-widest shadow-sm">
                            Currently Unavailable
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`shrink-0 w-4 h-4 flex items-center justify-center border ${item.isVeg ? 'border-green-600' : 'border-red-600'} bg-white rounded-sm`}>
                            <div className={`w-2 h-2 rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`}></div>
                          </div>
                          <h3 className="font-bold text-[16px] text-slate-900 leading-tight">{item.name}</h3>
                        </div>
                      </div>
                      <p className="text-[12px] text-slate-500 leading-relaxed mb-4 line-clamp-2">
                        {item.description || "Delicious food prepared fresh."}
                      </p>
                      <div className="flex justify-between items-center mt-auto">
                        <span className="font-bold text-[#a73a00] text-[16px]">₹{item.price}</span>
                        <button 
                          onClick={() => {
                            addToCart({
                              item: {
                                id: `food-${item._id}`,
                                name: item.name,
                                price: item.price,
                                quantity: 1,
                                img: (item.images && item.images[0]) || ""
                              },
                              vendorId: id as string,
                              vendorName: restaurant.name,
                              orderType: 'food'
                            });
                          }}
                          disabled={!item.isAvailable || !!getPlatformStatusMessage() || restaurant.availabilityStatus !== "open"}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-md transition-transform active:scale-90 ${
                            (!item.isAvailable || !!getPlatformStatusMessage() || restaurant.availabilityStatus !== "open") 
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                              : 'bg-[#a73a00] text-white hover:bg-[#8e3100]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>

      <FloatingCartButton />
      <BottomNavBar activeTab="menu" />
    </div>
  );
}
