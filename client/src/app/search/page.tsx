"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/services/api";
import { useLocation } from "@/context/LocationContext";
import { useCart } from "@/context/CartContext";
import { usePlatform } from "@/context/PlatformContext";
import OptimizedImage from "@/components/OptimizedImage";
import ProductCard from "@/components/ProductCard";
import BottomNavBar from "@/components/BottomNavBar";
import PlatformBanner from "@/components/PlatformBanner";

interface SearchResults {
  restaurants: any[];
  groceryProducts: any[];
  menuItems: any[];
}

function SearchResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParam = searchParams.get("q") || "";
  const { zoneId } = useLocation();
  const { cart, addToCart, updateQuantity } = useCart();
  const { getPlatformStatusMessage } = usePlatform();

  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [results, setResults] = useState<SearchResults>({
    restaurants: [],
    groceryProducts: [],
    menuItems: []
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "food" | "grocery" | "restaurant">("all");

  const fetchGlobalResults = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const url = `/search/global?q=${encodeURIComponent(q)}${zoneId ? `&zoneId=${zoneId}` : ""}`;
      const res = await apiClient.get(url);
      if (res.data.success) {
        setResults(res.data.results || { restaurants: [], groceryProducts: [], menuItems: [] });
      }
    } catch (err) {
      console.error("Failed to fetch global search results:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSearchQuery(queryParam);
    if (queryParam) {
      fetchGlobalResults(queryParam);
    }
  }, [queryParam, zoneId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const getProductQtyInCart = (productId: string) => {
    const item = cart.items.find(i => i.id === `groc-${productId}`);
    return item ? item.quantity : 0;
  };

  const isFoodInCart = (itemId: string) => {
    return cart.items.some(i => i.id === `food-${itemId}`);
  };

  const getFoodQtyInCart = (itemId: string) => {
    const item = cart.items.find(i => i.id === `food-${itemId}`);
    return item ? item.quantity : 0;
  };

  const handleAddFoodItem = (item: any) => {
    const restId = item.restaurant?._id || item.restaurant;
    const restName = item.restaurant?.name || "Restaurant";
    addToCart({
      item: {
        id: `food-${item._id}`,
        name: item.name,
        price: item.price,
        quantity: 1,
        img: (item.images && item.images[0]) || ""
      },
      vendorId: restId,
      vendorName: restName,
      orderType: 'food'
    });
  };

  const hasRestaurants = results.restaurants.length > 0;
  const hasGroceries = results.groceryProducts.length > 0;
  const hasFood = results.menuItems.length > 0;
  const hasAnyResults = hasRestaurants || hasGroceries || hasFood;

  return (
    <div className="bg-[#fcfcfc] text-slate-900 pb-28 min-h-screen w-full font-sans">
      <PlatformBanner />
      <div className="max-w-7xl mx-auto w-full">
        {/* Search Header */}
        <header className="bg-[#fcfcfc] sticky top-0 z-40 pt-4 pb-2 px-4 sm:px-6 lg:px-8 border-b border-slate-100 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center shrink-0 hover:bg-slate-100 rounded-full transition-colors">
            <span className="material-symbols-outlined text-slate-700">arrow_back</span>
          </button>
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-lg flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 border border-slate-200 shadow-inner">
            <span className="material-symbols-outlined text-slate-400 text-[18px]">search</span>
            <input
              type="text"
              placeholder="Search dishes, groceries, restaurants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-full text-slate-800 placeholder-slate-400 font-medium"
              suppressHydrationWarning={true}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200"
              >
                <span className="material-symbols-outlined text-sm font-bold">close</span>
              </button>
            )}
          </form>
        </header>

        {/* Tab Filters */}
        {hasAnyResults && (
          <div className="flex gap-2 justify-start overflow-x-auto no-scrollbar px-4 sm:px-6 lg:px-8 py-3.5 border-b border-slate-50 bg-white">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 whitespace-nowrap border ${
                activeTab === "all"
                  ? "bg-[#FF5C00] text-white border-transparent shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              All Results
            </button>
            {hasFood && (
              <button
                onClick={() => setActiveTab("food")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 whitespace-nowrap border ${
                  activeTab === "food"
                    ? "bg-[#FF5C00] text-white border-transparent shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Dishes ({results.menuItems.length})
              </button>
            )}
            {hasGroceries && (
              <button
                onClick={() => setActiveTab("grocery")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 whitespace-nowrap border ${
                  activeTab === "grocery"
                    ? "bg-[#FF5C00] text-white border-transparent shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Groceries ({results.groceryProducts.length})
              </button>
            )}
            {hasRestaurants && (
              <button
                onClick={() => setActiveTab("restaurant")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 whitespace-nowrap border ${
                  activeTab === "restaurant"
                    ? "bg-[#FF5C00] text-white border-transparent shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Restaurants ({results.restaurants.length})
              </button>
            )}
          </div>
        )}

        {/* Content Area */}
        <main className="px-4 sm:px-6 lg:px-8 py-5">
          {loading ? (
            /* Loading Shimmer Skeletons */
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="h-4 w-40 bg-slate-200 rounded animate-pulse"></div>
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-4 p-4 bg-white rounded-2xl border border-slate-100 animate-pulse">
                    <div className="w-16 h-16 bg-slate-200 rounded-lg shrink-0"></div>
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                      <div className="h-3 bg-slate-150 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !queryParam ? (
            <div className="text-center py-16 text-slate-400 max-w-md mx-auto">
              <span className="material-symbols-outlined text-5xl text-slate-200 block mb-2">search</span>
              <p className="text-sm font-bold text-slate-500">Type something to search</p>
              <p className="text-xs text-slate-400 mt-1">We will search globally across restaurants, fresh groceries, and food dishes.</p>
            </div>
          ) : !hasAnyResults ? (
            <div className="text-center py-16 text-slate-400 max-w-md mx-auto">
              <span className="material-symbols-outlined text-5xl text-slate-200 block mb-3">search_off</span>
              <p className="text-[15px] font-black text-slate-700">No matches found for "{queryParam}"</p>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Check spelling, try more generic words, or select a different delivery zone to expand your search.
              </p>
            </div>
          ) : (
            <div className="space-y-8 max-w-5xl mx-auto">
              {/* 1. DISHES & FOOD SECTION */}
              {(activeTab === "all" || activeTab === "food") && hasFood && (
                <section className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Dishes & Prepared Food</h2>
                    {activeTab === "all" && (
                      <button onClick={() => setActiveTab("food")} className="text-[11px] font-bold text-[#FF5C00]">
                        View all {results.menuItems.length}
                      </button>
                    )}
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl divide-y divide-slate-50 overflow-hidden shadow-sm">
                    {results.menuItems.slice(0, activeTab === "all" ? 3 : undefined).map((item) => {
                      const restId = item.restaurant?._id || item.restaurant;
                      const restName = item.restaurant?.name || "Local Kitchen";
                      return (
                        <div key={item._id} className="flex items-center gap-3 p-3.5 hover:bg-slate-50/50 transition-colors">
                          <div className="w-14 h-14 bg-slate-50 rounded-xl overflow-hidden shrink-0 border border-slate-100 relative">
                            <OptimizedImage
                              src={(item.images && item.images[0]) || ""}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              preset="thumbnail"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`shrink-0 w-3 h-3 flex items-center justify-center border text-[6px] font-black leading-none rounded-sm ${item.isVeg ? 'border-green-600 text-green-600' : 'border-red-600 text-red-600'}`}>
                                ●
                              </span>
                              <h3 className="text-[13.5px] font-extrabold text-slate-800 truncate leading-snug">{item.name}</h3>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 truncate">
                              from <Link href={`/restaurants/${restId}`} className="text-[#FF5C00] font-bold hover:underline">{restName}</Link>
                            </p>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <span className="text-[13.5px] font-black text-slate-800">₹{item.price}</span>
                            
                            {isFoodInCart(item._id) ? (
                              <div className="flex items-center bg-[#FF5C00] text-white rounded-xl overflow-hidden text-xs font-black shadow-sm h-8">
                                <button
                                  onClick={() => updateQuantity(`food-${item._id}`, getFoodQtyInCart(item._id) - 1)}
                                  className="px-2.5 h-full hover:bg-[#e05200] transition-colors"
                                >
                                  -
                                </button>
                                <span className="px-2">{getFoodQtyInCart(item._id)}</span>
                                <button
                                  onClick={() => updateQuantity(`food-${item._id}`, getFoodQtyInCart(item._id) + 1)}
                                  className="px-2.5 h-full hover:bg-[#e05200] transition-colors"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAddFoodItem(item)}
                                disabled={!item.isAvailable || !!getPlatformStatusMessage() || item.restaurant?.availabilityStatus !== "open"}
                                className="h-8 px-4 bg-white border border-[#FF5C00] text-[#FF5C00] font-black text-xs uppercase tracking-wider rounded-xl hover:bg-[#FF5C00]/5 transition-all shadow-sm active:scale-95 disabled:border-slate-200 disabled:text-slate-400 disabled:bg-slate-50 disabled:shadow-none"
                              >
                                {item.isAvailable ? "Add" : "OOS"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 2. GROCERIES SECTION */}
              {(activeTab === "all" || activeTab === "grocery") && hasGroceries && (
                <section className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Grocery Products</h2>
                    {activeTab === "all" && (
                      <button onClick={() => setActiveTab("grocery")} className="text-[11px] font-bold text-[#FF5C00]">
                        View all {results.groceryProducts.length}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {results.groceryProducts.slice(0, activeTab === "all" ? 4 : undefined).map((prod) => (
                      <ProductCard
                        key={prod._id}
                        prod={prod}
                        qty={getProductQtyInCart(prod._id)}
                        addToCart={addToCart}
                        updateQuantity={updateQuantity}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* 3. RESTAURANTS SECTION */}
              {(activeTab === "all" || activeTab === "restaurant") && hasRestaurants && (
                <section className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Restaurants</h2>
                    {activeTab === "all" && (
                      <button onClick={() => setActiveTab("restaurant")} className="text-[11px] font-bold text-[#FF5C00]">
                        View all {results.restaurants.length}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {results.restaurants.slice(0, activeTab === "all" ? 4 : undefined).map((rest) => (
                      <Link href={`/restaurants/${rest._id}`} key={rest._id} className="block group">
                        <div className="bg-white rounded-2xl overflow-hidden border border-slate-100/80 shadow-sm transition-transform active:scale-[0.98] hover:shadow-md h-full flex flex-col">
                          <div className="h-32 w-full relative bg-slate-50">
                            <OptimizedImage
                              src={rest.image || ""}
                              alt={rest.name}
                              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                              preset="card"
                            />
                            {rest.availabilityStatus !== "open" && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span className="bg-rose-600 text-white text-[8px] font-black tracking-widest px-2 py-0.5 rounded">CLOSED</span>
                              </div>
                            )}
                          </div>
                          <div className="p-3 flex-1 flex flex-col justify-between">
                            <div>
                              <h3 className="font-extrabold text-[13.5px] text-slate-800 truncate leading-snug group-hover:text-[#FF5C00] transition-colors">{rest.name}</h3>
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{rest.cuisines || "Multi-cuisine"}</p>
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50 text-[10px] font-bold text-slate-400">
                              <span className="flex items-center gap-0.5 text-amber-500">
                                <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                <span>{rest.rating > 0 ? rest.rating.toFixed(1) : "New"}</span>
                              </span>
                              <span>{rest.location?.address?.split(",")?.[0] || "Local area"}</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
      <BottomNavBar activeTab="search" />
    </div>
  );
}

export default function SearchResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#FF5C00] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <SearchResultsContent />
    </Suspense>
  );
}
