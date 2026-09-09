"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import BottomNavBar from "@/components/BottomNavBar";
import FloatingCartButton from "@/components/FloatingCartButton";
import OptimizedImage from "@/components/OptimizedImage";
import { apiClient } from "@/services/api";
import { useCart } from "@/context/CartContext";
import {
  MdSearch,
  MdClose,
  MdStore,
  MdRestaurantMenu,
  MdAdd,
  MdRemove,
  MdChevronRight,
  MdImage,
} from "react-icons/md";

interface MenuItemType {
  _id: string;
  name: string;
  description?: string;
  price: number;
  discountedPrice?: number;
  isFeatured?: boolean;
  prepTimeMinutes?: number;
  spiceLevel?: "none" | "mild" | "medium" | "hot";
  category?: string;
  images?: string[];
  isAvailable?: boolean;
  isVeg?: boolean;
  restaurant?: {
    _id: string;
    name: string;
    location?: { address?: string };
    phone?: string;
  } | string;
}

export default function FoodDiscoveryPage() {
  const { cart, addToCart, updateQuantity } = useCart();

  const [items, setItems] = useState<MenuItemType[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [vegOnly, setVegOnly] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Selected item for the Detail Modal
  const [selectedItem, setSelectedItem] = useState<MenuItemType | null>(null);
  const [relatedItems, setRelatedItems] = useState<MenuItemType[]>([]);
  const [loadingRelated, setLoadingRelated] = useState<boolean>(false);

  // Initialize search & category from URL on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q") || params.get("search");
      const cat = params.get("category");
      if (q) setSearchQuery(q);
      if (cat) setActiveCategory(cat);
    }
  }, []);

  // Fetch dynamic categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await apiClient.get("/search/menu-categories");
        if (res.data.success && Array.isArray(res.data.categories)) {
          setCategories(res.data.categories);
        }
      } catch (err) {
        console.error("Failed to load menu categories:", err);
      }
    };
    fetchCategories();
  }, []);

  // Fetch food items based on search query, category, and veg filter
  useEffect(() => {
    const fetchMenuItems = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) {
          params.set("q", searchQuery.trim());
        }
        if (activeCategory && activeCategory !== "All") {
          params.set("category", activeCategory);
        }
        if (vegOnly) {
          params.set("isVeg", "true");
        }
        params.set("limit", "20");

        const res = await apiClient.get(`/search/menu-items?${params.toString()}`);
        if (res.data.success) {
          setItems(res.data.results || []);
        } else {
          setItems([]);
        }
      } catch (err) {
        console.error("Failed to fetch menu items:", err);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchMenuItems();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, activeCategory, vegOnly]);

  // Fetch related items when detail modal item changes
  useEffect(() => {
    if (!selectedItem || !selectedItem.category) {
      setRelatedItems([]);
      return;
    }

    const fetchRelated = async () => {
      setLoadingRelated(true);
      try {
        const res = await apiClient.get(
          `/search/menu-items?category=${encodeURIComponent(selectedItem.category || "")}&limit=6`
        );
        if (res.data.success && Array.isArray(res.data.results)) {
          // Exclude currently open item
          const filtered = res.data.results.filter(
            (it: MenuItemType) => it._id !== selectedItem._id
          );
          setRelatedItems(filtered);
        } else {
          setRelatedItems([]);
        }
      } catch (err) {
        console.error("Failed to fetch related items:", err);
        setRelatedItems([]);
      } finally {
        setLoadingRelated(false);
      }
    };

    fetchRelated();
  }, [selectedItem]);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedItem(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const getCartQuantity = (itemId: string) => {
    const found = cart.items.find((i) => i.id === `food-${itemId}`);
    return found ? found.quantity : 0;
  };

  const getEffectivePrice = (item: MenuItemType) => {
    if (item.discountedPrice && Number(item.discountedPrice) > 0) {
      return item.discountedPrice;
    }
    return item.price;
  };

  const getRestaurantInfo = (item: MenuItemType) => {
    if (item.restaurant && typeof item.restaurant === "object") {
      return {
        id: item.restaurant._id,
        name: item.restaurant.name || "Restaurant",
        address: item.restaurant.location?.address,
      };
    }
    return {
      id: (item.restaurant as string) || "unknown-restaurant",
      name: "Restaurant",
      address: "",
    };
  };

  const handleAddItem = (item: MenuItemType, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const restInfo = getRestaurantInfo(item);
    const price = getEffectivePrice(item);

    addToCart({
      item: {
        id: `food-${item._id}`,
        name: item.name,
        price,
        quantity: 1,
        img: item.images && item.images[0] ? item.images[0] : "",
      },
      vendorId: restInfo.id,
      vendorName: restInfo.name,
      orderType: "food",
    });
  };

  return (
    <div className="bg-[#fcfcfc] text-on-surface pb-28 min-h-screen w-full font-sans">
      <div className="max-w-7xl mx-auto w-full">
        {/* Top Header & Search Bar */}
        <header className="bg-[#fcfcfc] sticky top-0 z-40 pt-4 pb-2 px-4 sm:px-6 lg:px-8 border-b border-slate-100 flex items-center justify-between gap-3 sm:gap-4">
          <Link href="/" className="font-bold text-base sm:text-xl text-primary tracking-tight shrink-0">
            ZipRocket
          </Link>

          <div className="flex items-center gap-2 flex-1 max-w-lg bg-slate-100 rounded-full px-3.5 py-2 border border-slate-200/80 focus-within:border-[#FF5C00]/50 focus-within:ring-2 focus-within:ring-[#FF5C00]/10 transition-all">
            <MdSearch className="text-slate-400 text-xl shrink-0" />
            <input
              type="text"
              placeholder="Search dishes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-full placeholder-slate-400 text-slate-800 font-medium"
              suppressHydrationWarning={true}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-full hover:bg-slate-200"
              >
                <MdClose className="text-base" />
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Category Pills Row */}
        <div className="flex gap-2 justify-start items-center overflow-x-auto no-scrollbar px-4 sm:px-6 lg:px-8 py-3.5 border-b border-slate-50">
          {/* "All" Pill */}
          <button
            onClick={() => setActiveCategory("All")}
            className={`px-4 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer shadow-xs ${
              activeCategory === "All"
                ? "bg-[#FF5C00] text-white shadow-sm shadow-[#FF5C00]/20"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            All
          </button>

          {/* Dynamic Categories */}
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? "All" : cat)}
              className={`px-4 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer shadow-xs ${
                activeCategory === cat
                  ? "bg-[#FF5C00] text-white shadow-sm shadow-[#FF5C00]/20"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {cat}
            </button>
          ))}

          {/* Veg Only Filter Pill */}
          <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />
          <button
            onClick={() => setVegOnly(!vegOnly)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[13px] font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer shrink-0 ${
              vegOnly
                ? "border-green-600 bg-green-50 text-green-800"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${vegOnly ? "bg-green-600" : "bg-slate-300"}`} />
            <span>Veg Only</span>
          </button>
        </div>

        {/* Food Items Discovery Grid */}
        <main className="px-4 sm:px-6 lg:px-8 py-5 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-[14px] sm:text-base font-extrabold text-slate-800 tracking-tight">
              {searchQuery
                ? `Results for "${searchQuery}"`
                : activeCategory !== "All"
                ? `${activeCategory} Dishes`
                : "Popular & Featured Dishes"}
            </h2>
            <span className="text-[11px] font-semibold text-slate-400">
              {loading ? "Finding dishes..." : `${items.length} dishes available`}
            </span>
          </div>

          {loading ? (
            /* Loading Skeletons */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-slate-100 p-3 h-64 animate-pulse flex flex-col justify-between"
                >
                  <div className="h-32 bg-slate-100 rounded-xl w-full" />
                  <div className="space-y-2 mt-3">
                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                    <div className="h-4 bg-slate-100 rounded w-1/3 mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            /* Empty State */
            <div className="text-center py-20 flex flex-col items-center">
              <div className="w-16 h-16 bg-orange-50 text-[#FF5C00] rounded-full flex items-center justify-center mb-3">
                <MdRestaurantMenu className="text-3xl" />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">No dishes found</h3>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                {searchQuery
                  ? `No dishes matching "${searchQuery}". Try searching for pizza, biryani, or cake.`
                  : "No dishes found in this category. Try selecting another category or removing filters."}
              </p>
              {(searchQuery || activeCategory !== "All" || vegOnly) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setActiveCategory("All");
                    setVegOnly(false);
                  }}
                  className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            /* Responsive 2-Col Mobile Grid Scaling to 3-5 Columns */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {items.map((item) => {
                const qty = getCartQuantity(item._id);
                const currentPrice = getEffectivePrice(item);
                const restInfo = getRestaurantInfo(item);

                return (
                  <div
                    key={item._id}
                    onClick={() => setSelectedItem(item)}
                    className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(255,92,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col relative group cursor-pointer"
                  >
                    {/* Bestseller Badge */}
                    {item.isFeatured && (
                      <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-amber-500 text-white font-black text-[9px] rounded-md shadow-sm">
                        🔥 Bestseller
                      </span>
                    )}

                    {/* Image box */}
                    <div className="p-2 sm:p-3 bg-white relative flex justify-center items-center h-28 sm:h-36 md:h-40 border-b border-slate-50 shrink-0 overflow-hidden">
                      {item.images && item.images[0] ? (
                        <OptimizedImage
                          src={item.images[0]}
                          alt={item.name}
                          preset="card"
                          className="h-full w-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-xl">
                          <MdImage className="text-slate-300 text-3xl" />
                        </div>
                      )}

                      {/* Add to Cart / Quantity Stepper Overlay */}
                      <div className="absolute -bottom-3 right-2 sm:right-3 shrink-0 z-10">
                        {qty > 0 ? (
                          <div className="flex items-center bg-white border border-[#FF5C00] rounded-xl shadow-md overflow-hidden font-black text-xs">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(`food-${item._id}`, qty - 1);
                              }}
                              className="px-2 py-1.5 hover:bg-slate-50 text-[#FF5C00] transition-colors"
                            >
                              -
                            </button>
                            <span className="px-2 text-slate-800 font-bold">{qty}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(`food-${item._id}`, qty + 1);
                              }}
                              className="px-2 py-1.5 hover:bg-slate-50 text-[#FF5C00] transition-colors"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={item.isAvailable === false}
                            onClick={(e) => handleAddItem(item, e)}
                            className={`bg-white border font-black text-[11px] px-3.5 py-1.5 rounded-xl shadow-md uppercase tracking-wider transition-all duration-200 active:scale-95 ${
                              item.isAvailable === false
                                ? "border-slate-300 text-slate-400 bg-slate-50 cursor-default shadow-none"
                                : "border-[#FF5C00] text-[#FF5C00] hover:bg-[#FF5C00]/5"
                            }`}
                          >
                            {item.isAvailable === false ? "Unavailable" : "Add"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Details Box */}
                    <div className="p-3 pt-5 flex-1 flex flex-col justify-between bg-white">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <div
                            className={`shrink-0 w-3.5 h-3.5 flex items-center justify-center border ${
                              item.isVeg ? "border-green-600" : "border-red-600"
                            } bg-white rounded-[3px]`}
                          >
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.isVeg ? "bg-green-600" : "bg-red-600"
                              }`}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold truncate">
                            {item.category || "Dish"}
                          </span>
                        </div>

                        <h4 className="text-[13px] font-bold text-slate-800 leading-snug line-clamp-1 group-hover:text-[#FF5C00] transition-colors">
                          {item.name}
                        </h4>

                        <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                          from {restInfo.name}
                        </p>
                      </div>

                      <div className="mt-3 flex items-baseline gap-1.5">
                        <span className="text-sm font-black text-slate-900">₹{currentPrice}</span>
                        {item.discountedPrice &&
                          Number(item.discountedPrice) > 0 &&
                          item.price > item.discountedPrice && (
                            <span className="text-xs font-semibold text-slate-400 line-through">
                              ₹{item.price}
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Food Item Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="relative bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close"
            >
              <MdClose className="text-lg" />
            </button>

            {/* Scrollable Modal Content */}
            <div className="overflow-y-auto custom-scrollbar flex-1">
              {/* Large Image Banner */}
              <div className="relative h-56 sm:h-64 w-full bg-slate-100 shrink-0">
                {selectedItem.images && selectedItem.images[0] ? (
                  <OptimizedImage
                    src={selectedItem.images[0]}
                    alt={selectedItem.name}
                    preset="card"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100">
                    <MdImage className="text-slate-300 text-5xl" />
                  </div>
                )}

                {selectedItem.isFeatured && (
                  <div className="absolute top-3 left-3 bg-amber-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md">
                    🔥 Bestseller
                  </div>
                )}

                {selectedItem.isAvailable === false && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <span className="bg-white/95 px-3 py-1 rounded-full text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Currently Unavailable
                    </span>
                  </div>
                )}
              </div>

              {/* Dish Info Body */}
              <div className="p-5 space-y-4">
                {/* Title & Veg Badge */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className={`shrink-0 w-4 h-4 flex items-center justify-center border ${
                        selectedItem.isVeg ? "border-green-600" : "border-red-600"
                      } bg-white rounded-sm`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          selectedItem.isVeg ? "bg-green-600" : "bg-red-600"
                        }`}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {selectedItem.category || "Food Item"}
                    </span>
                  </div>

                  <h3 className="text-xl font-extrabold text-slate-900 leading-tight">
                    {selectedItem.name}
                  </h3>

                  {/* Restaurant link */}
                  {(() => {
                    const restInfo = getRestaurantInfo(selectedItem);
                    return (
                      <Link
                        href={`/restaurants/${restInfo.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#FF5C00] hover:underline mt-1 group"
                      >
                        <MdStore className="text-sm" />
                        <span>from {restInfo.name}</span>
                        <MdChevronRight className="text-sm group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    );
                  })()}
                </div>

                {/* Description */}
                {selectedItem.description && (
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    {selectedItem.description}
                  </p>
                )}

                {/* Tags (Prep time, spice level) */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                    ⏱️ ~{selectedItem.prepTimeMinutes || 15} min
                  </span>
                  {selectedItem.spiceLevel && selectedItem.spiceLevel !== "none" && (
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
                        selectedItem.spiceLevel === "hot"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : selectedItem.spiceLevel === "medium"
                          ? "bg-orange-50 text-orange-700 border border-orange-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {selectedItem.spiceLevel === "hot"
                        ? "🌶️🌶️🌶️ Hot"
                        : selectedItem.spiceLevel === "medium"
                        ? "🌶️🌶️ Medium"
                        : "🌶️ Mild"}
                    </span>
                  )}
                </div>

                {/* Price & Add to Cart Section */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900">
                      ₹{getEffectivePrice(selectedItem)}
                    </span>
                    {selectedItem.discountedPrice &&
                      Number(selectedItem.discountedPrice) > 0 &&
                      selectedItem.price > selectedItem.discountedPrice && (
                        <span className="text-sm font-semibold text-slate-400 line-through">
                          ₹{selectedItem.price}
                        </span>
                      )}
                  </div>

                  {(() => {
                    const qty = getCartQuantity(selectedItem._id);
                    if (qty > 0) {
                      return (
                        <div className="flex items-center bg-[#FF5C00] text-white rounded-xl shadow-md overflow-hidden font-black text-sm">
                          <button
                            onClick={() => updateQuantity(`food-${selectedItem._id}`, qty - 1)}
                            className="px-3 py-2 hover:bg-[#e05200] transition-colors"
                          >
                            <MdRemove />
                          </button>
                          <span className="px-3">{qty}</span>
                          <button
                            onClick={() => updateQuantity(`food-${selectedItem._id}`, qty + 1)}
                            className="px-3 py-2 hover:bg-[#e05200] transition-colors"
                          >
                            <MdAdd />
                          </button>
                        </div>
                      );
                    }
                    return (
                      <button
                        disabled={selectedItem.isAvailable === false}
                        onClick={() => handleAddItem(selectedItem)}
                        className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 ${
                          selectedItem.isAvailable === false
                            ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                            : "bg-[#FF5C00] hover:bg-[#e05200] text-white shadow-[#FF5C00]/20"
                        }`}
                      >
                        <MdAdd className="text-base" />
                        <span>{selectedItem.isAvailable === false ? "Unavailable" : "Add to Cart"}</span>
                      </button>
                    );
                  })()}
                </div>

                {/* More from this Category Row */}
                {selectedItem.category && (
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        More from {selectedItem.category}
                      </h4>
                      <span className="text-[10px] font-semibold text-slate-400">
                        Tap dish to view
                      </span>
                    </div>

                    {loadingRelated ? (
                      <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-2">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="min-w-[130px] h-28 bg-slate-100 rounded-xl animate-pulse shrink-0"
                          />
                        ))}
                      </div>
                    ) : relatedItems.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">
                        No other dishes in this category.
                      </p>
                    ) : (
                      <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-2">
                        {relatedItems.map((relItem) => {
                          const relPrice = getEffectivePrice(relItem);
                          return (
                            <div
                              key={relItem._id}
                              onClick={() => setSelectedItem(relItem)}
                              className="min-w-[130px] max-w-[140px] bg-slate-50 hover:bg-orange-50/50 border border-slate-100 rounded-xl p-2 cursor-pointer transition-all shrink-0 active:scale-95 group flex flex-col justify-between"
                            >
                              <div className="h-18 w-full rounded-lg overflow-hidden bg-slate-200 mb-1.5 relative">
                                {relItem.images && relItem.images[0] ? (
                                  <OptimizedImage
                                    src={relItem.images[0]}
                                    alt={relItem.name}
                                    preset="thumbnail"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <MdImage className="text-slate-400 text-lg" />
                                  </div>
                                )}
                              </div>
                              <p className="text-[11px] font-bold text-slate-800 line-clamp-1 group-hover:text-[#FF5C00] transition-colors leading-tight">
                                {relItem.name}
                              </p>
                              <p className="text-[10px] font-black text-slate-900 mt-1">
                                ₹{relPrice}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <FloatingCartButton />
      <BottomNavBar activeTab="search" />
    </div>
  );
}
