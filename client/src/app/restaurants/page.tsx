"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import BottomNavBar from "@/components/BottomNavBar";
import { useLocation } from "@/context/LocationContext";
import { getAllRestaurants } from "@/services/restaurantService";

import { apiClient } from "@/services/api";

// Helper: Resolve a relevant Unsplash image based on name/cuisines
const getRestaurantImage = (name: string, cuisines: string): string => {
  const n = name.toLowerCase();
  const c = cuisines.toLowerCase();
  if (n.includes("biryani") || c.includes("biryani")) {
    return "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=800"; // Biryani
  }
  if (n.includes("pizza") || c.includes("pizza")) {
    return "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=800"; // Pizza
  }
  if (n.includes("burger") || c.includes("burger")) {
    return "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800"; // Burger
  }
  if (n.includes("sweet") || c.includes("sweet") || c.includes("street food")) {
    return "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&q=80&w=800"; // Sweets / Samosa
  }
  if (c.includes("south indian")) {
    return "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&q=80&w=800"; // Dosa
  }
  return "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800"; // Default
};

export default function RestaurantsPage() {
  const { zoneId, zoneName } = useLocation();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Initialize search query from URL params on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q") || params.get("search");
      if (q) {
        setSearchQuery(q);
      }
    }
  }, []);

  // Filters state
  const [vegOnly, setVegOnly] = useState(false);
  const [sortByRating, setSortByRating] = useState(false);

  useEffect(() => {
    const fetchRestaurants = async () => {
      setLoading(true);
      try {
        let data = [];
        if (searchQuery.trim()) {
          const url = `/search/restaurants?q=${encodeURIComponent(searchQuery)}&status=approved&isActive=true${zoneId ? `&deliveryZone=${zoneId}` : ""}`;
          const response = await apiClient.get(url);
          data = response.data.results || [];
        } else {
          // Fetch only active, approved restaurants in the active delivery zone
          data = await getAllRestaurants("approved", zoneId);
        }
        setRestaurants(data);
      } catch (error) {
        console.error("Failed to load restaurants:", error);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchRestaurants();
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [zoneId, searchQuery]);

  // Apply filters
  let filtered = [...restaurants];
  if (vegOnly) {
    filtered = filtered.filter(r => r.cuisines?.toLowerCase().includes("veg"));
  }
  if (sortByRating) {
    filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  // Feature restaurants with high rating (>= 4.5)
  const featuredRestaurants = filtered.filter(r => (r.rating || 0) >= 4.5);

  return (
    <div className="bg-[#fcfcfc] text-on-surface pb-28 min-h-screen w-full font-sans">
      <div className="max-w-7xl mx-auto w-full">
        {/* Top Search Bar */}
        <header className="bg-[#fcfcfc] sticky top-0 z-40 pt-4 pb-2 px-4 sm:px-6 lg:px-8 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 max-w-md bg-slate-100 rounded-full px-3 py-1.5 border border-slate-200">
            <span className="material-symbols-outlined text-slate-400">search</span>
            <input
              type="text"
              placeholder="Search restaurants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-full placeholder-slate-400 text-slate-800"
            />
          </div>
          <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 cursor-pointer shrink-0">
            <img
              alt="User Profile"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD5iEnRAbZdcMCEE6FhrZx4jSPayqCNcc13TkynQfP8Ng5bKnT9LupfoId4PYadysnp5cErwKtTUS3JAeY8hYJLszSf_x_r_rX4Jpz3N0O_nT77wcoQTamIwUSvVHlNLZHPXpSLfOPIPphXQc4o4n12VZBz5DWo_h8OnCypahluYJeLZuxn5O7Mmsa0IgVei7eZGnJv7iphDh1Hswpkx2nFlKPs57_gzSD5TBFyWYd4ntPScL37OM-jaZl1g-6MjcYGxmtvD3O7Zds"
            />
          </div>
        </header>

        {/* Filter Chips */}
        <div className="flex gap-2.5 justify-start overflow-x-auto no-scrollbar px-4 sm:px-6 lg:px-8 py-4">
          <button 
            onClick={() => setVegOnly(!vegOnly)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full border transition-all active:scale-95 cursor-pointer text-[13px] font-medium ${
              vegOnly 
                ? "border-green-600 bg-green-50 text-green-800" 
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>Veg Only</span>
            <span className={`w-2 h-2 rounded-full ${vegOnly ? 'bg-green-700' : 'bg-slate-300'}`}></span>
          </button>
          <button 
            onClick={() => setSortByRating(!sortByRating)}
            className={`flex items-center gap-1 px-4 py-1.5 rounded-full border transition-all active:scale-95 cursor-pointer text-[13px] font-medium ${
              sortByRating 
                ? "border-[#a73a00] bg-[#faeddf] text-[#a73a00]" 
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>Top Rated</span>
            <span className="material-symbols-outlined text-[14px]">star</span>
          </button>
        </div>

        <main className="px-4 sm:px-6 lg:px-8 space-y-8">
          {loading ? (
            // Loading Skeletons
            <div className="space-y-6">
              <div className="h-4 w-40 bg-slate-200 rounded animate-pulse"></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-56 bg-slate-100 rounded-xl animate-pulse"></div>
                ))}
              </div>
            </div>
          ) : filtered.length === 0 ? (
            // Empty State
            <div className="text-center py-16 flex flex-col items-center">
              <span className="material-symbols-outlined text-5xl text-slate-300">store_off</span>
              <h3 className="text-lg font-bold text-slate-700 mt-2">No Restaurants Found</h3>
              <p className="text-sm text-slate-500 mt-1">
                {zoneId 
                  ? "Try removing filters or check back later." 
                  : "Please select a delivery location to see restaurants in your area."}
              </p>
            </div>
          ) : (
            <>
              {/* Featured Restaurants */}
              {featuredRestaurants.length > 0 && (
                <section>
                  <h2 className="text-[13px] font-semibold mb-3 text-slate-800 tracking-wide uppercase">Featured Restaurants</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {featuredRestaurants.map((rest) => (
                      <Link href={`/restaurants/${rest._id}`} key={`featured-${rest._id}`}>
                        <div className="bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm transition-transform active:scale-[0.98] cursor-pointer hover:shadow-md h-full flex flex-col">
                          <div className="h-40 relative w-full shrink-0">
                            <img
                              className="w-full h-full object-cover"
                              src={getRestaurantImage(rest.name, rest.cuisines || "")}
                              alt={rest.name}
                            />
                            <div className="absolute top-2 left-2 bg-[#a73a00] text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Top Rated
                            </div>
                          </div>
                          <div className="p-3 flex justify-between items-start flex-1">
                            <div>
                              <h3 className="font-semibold text-[14px] text-slate-900 leading-tight truncate max-w-[180px]">{rest.name}</h3>
                              <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{rest.cuisines || "Multi-cuisine"}</p>
                            </div>
                            <div className="flex items-center gap-0.5 bg-green-200/60 text-green-800 px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0">
                              <span>{rest.rating || "New"}</span>
                              <span className="material-symbols-outlined text-[12px] font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Restaurants near you */}
              <section>
                <h2 className="text-[13px] font-semibold mb-3 text-slate-800 tracking-wide uppercase">
                  {zoneName ? `Serviceable in ${zoneName}` : "All Restaurants"}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filtered.map((rest) => (
                    <Link href={`/restaurants/${rest._id}`} key={rest._id}>
                      <div className="bg-white rounded-xl overflow-hidden border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-transform active:scale-[0.98] cursor-pointer hover:shadow-md h-full flex flex-col">
                        <div className="h-44 relative w-full shrink-0">
                          <img
                            className="w-full h-full object-cover"
                            src={getRestaurantImage(rest.name, rest.cuisines || "")}
                            alt={rest.name}
                          />
                          <div className="absolute bottom-0 left-0 bg-[#a73a00] text-white text-[10px] font-semibold px-2.5 py-1 rounded-tr-xl">
                            Flat {rest.commission || 10}% Commission Tier
                          </div>
                        </div>
                        <div className="p-3 flex-1 flex flex-col justify-between">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-[14px] text-slate-900 leading-tight truncate max-w-[180px]">{rest.name}</h3>
                              <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{rest.cuisines || "Multi-cuisine"}</p>
                            </div>
                            <div className="flex items-center gap-0.5 bg-green-700 text-white px-1.5 py-0.5 rounded text-[11px] font-bold shadow-sm shrink-0">
                              <span>{rest.rating || "New"}</span>
                              <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-50 flex justify-between items-center text-[10px] text-slate-600">
                            <div className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px] text-[#a73a00]" style={{ fontVariationSettings: "'FILL' 1" }}>store</span>
                              <span className="font-medium">{rest.totalOrders || 0} orders served</span>
                            </div>
                            <span className="text-emerald-600 font-semibold">Deliverable</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      <BottomNavBar activeTab="search" />
    </div>
  );
}
