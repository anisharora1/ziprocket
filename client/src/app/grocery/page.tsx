"use client";

import { useEffect, useState, useRef } from "react";
import Header from "@/components/Header";
import OptimizedImage from "@/components/OptimizedImage";
import BottomNavBar from "@/components/BottomNavBar";
import FloatingCartButton from "@/components/FloatingCartButton";
import { useCart } from "@/context/CartContext";
import { apiClient } from "@/services/api";
import Link from "next/link";
import { usePlatform } from "@/context/PlatformContext";
import ProductCard from "@/components/ProductCard";
import { MdSearch, MdError, MdShoppingBag, MdChevronRight } from "react-icons/md";

import { GROCERY_CATEGORIES_MAP, GROCERY_CATEGORY_DISPLAY } from "@/lib/groceryCategories";

interface Product {
  _id: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  price: number;
  discountedPrice?: number;
  stockQuantity: number;
  unit: string;
  images: string[];
  weightSize: string;
  isAvailable: boolean;
  offerBadge?: string;
}

const CATEGORIES = Object.keys(GROCERY_CATEGORIES_MAP).map((id) => ({
  id,
  ...GROCERY_CATEGORY_DISPLAY[id],
}));

export default function GroceryPage() {
  const { addToCart, cart, updateQuantity } = useCart();
  const { getGroceryStatusMessage } = usePlatform();
  const groceryStatusMessage = getGroceryStatusMessage();
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const [featuredRes, latestRes] = await Promise.all([
          apiClient.get("/grocery?isFeatured=true&limit=8"),
          apiClient.get("/grocery?limit=10")
        ]);

        if (featuredRes.data.success) {
          setFeaturedProducts(featuredRes.data.products);
        }
        if (latestRes.data.success) {
          setRecentProducts(latestRes.data.products);
        }
      } catch (err) {
        console.error("Failed to load customer catalog:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, []);

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const res = await apiClient.get(`/grocery?search=${encodeURIComponent(val)}&limit=15`);
      if (res.data.success) {
        setSearchResults(res.data.products);
      }
    } catch (err) {
      console.error("Grocery search failed:", err);
    }
  };

  // Initialize search query from URL params on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q") || params.get("search");
      if (q) {
        handleSearch(q);
      }
    }
  }, []);

  const getCartQuantity = (productId: string) => {
    const item = cart.items.find(i => i.id === `groc-${productId}`);
    return item ? item.quantity : 0;
  };

  return (
    <div className="bg-[#fcfcfc] text-on-surface pb-28 min-h-screen w-full font-sans">
      <Header />

      <main className="mt-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 animate-in fade-in duration-300">

        {/* Quick Commerce Search Banner */}
        <div className="bg-gradient-to-br from-[#FF5C00] via-[#FF5C00] to-[#E05200] rounded-2xl p-6 md:p-8 text-white relative overflow-hidden shadow-lg shadow-[#FF5C00]/15">
          <div className="absolute inset-0 bg-grid-white opacity-5 pointer-events-none"></div>

          <div className="max-w-[576px] relative z-10 space-y-4">
            <span className="inline-block px-3 py-1 bg-white/20 text-white font-extrabold text-[10px] rounded-full uppercase tracking-widest">
              Delivery in 10 Minutes
            </span>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-tight">
              ZipGrocery Store
            </h1>
            <p className="text-orange-50 text-sm font-semibold">
              Get fresh vegetables, dairy, household items and munchies delivered in tier-3 cities!
            </p>

            {/* Instant Search Bar */}
            <div className="flex items-center bg-white text-slate-800 border border-slate-200/50 rounded-2xl overflow-hidden focus-within:ring-4 focus-within:ring-[#FF5C00]/10 shadow-md transition-all">
              <MdSearch className="text-slate-400 text-[20px] flex items-center pl-4 pr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search fresh vegetables, oils, milk or snacks..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full py-4 bg-transparent text-sm font-bold focus:outline-none placeholder:text-slate-300 text-slate-900"
                suppressHydrationWarning={true}
              />
            </div>
          </div>
        </div>

        {/* Grocery Operations Status Banner */}
        {groceryStatusMessage && (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
            <MdError className="text-rose-500 shrink-0 text-[20px]" />
            <div className="space-y-1">
              <h4 className="text-[13px] font-bold text-rose-800">Grocery Delivery Unavailable</h4>
              <p className="text-[12px] text-rose-600 leading-relaxed font-semibold">
                {groceryStatusMessage}
              </p>
            </div>
          </div>
        )}

        {/* Search Results Drawer */}
        {searchQuery && (
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-slate-800 text-base">
                Search Results for "{searchQuery}"
              </h3>
              <button
                onClick={() => handleSearch("")}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Clear Search
              </button>
            </div>

            {searchResults.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs font-bold">
                <MdShoppingBag className="text-[32px] text-slate-200 block mb-2 mx-auto" />
                No grocery items match your search. Try "milk" or "oil".
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {searchResults.map((prod) => (
                  <ProductCard key={prod._id} prod={prod} qty={getCartQuantity(prod._id)} addToCart={addToCart} updateQuantity={updateQuantity} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Category Tiles Grid */}
        {!searchQuery && (
          <div className="space-y-4">
            <h2 className="text-[13px] font-semibold text-slate-800 tracking-wide uppercase">Shop by Category</h2>
            {loading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-4">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div
                    key={i}
                    className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2 animate-pulse h-[116px]"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-slate-100" />
                    <div className="h-3 w-16 bg-slate-100 rounded mt-1" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-4">
                {CATEGORIES.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/grocery/category/${encodeURIComponent(cat.id)}`}
                    className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2 hover:shadow-[0_4px_20px_rgba(255,92,0,0.06)] hover:border-[#FF5C00]/20 transition-all duration-300 group cursor-pointer"
                  >
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 border ${cat.color} overflow-hidden shadow-sm bg-white`}>
                      <OptimizedImage src={cat.image} alt={cat.name} preset="thumbnail" className="w-full h-full object-cover group-hover:rotate-3 transition-transform duration-300" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800 line-clamp-1 leading-snug">
                      {cat.name}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Featured Products Row */}
        {!searchQuery && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-[13px] font-semibold text-slate-800 tracking-wide uppercase">Best Deals & Featured</h2>
              <Link href="/grocery/category/Vegetables%20%26%20Fruits" className="text-xs font-bold text-[#FF5C00] hover:text-[#e05200] flex items-center gap-0.5 transition-colors">
                See all
                <MdChevronRight className="text-[14px]" />
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 h-56 animate-pulse"></div>
                ))}
              </div>
            ) : featuredProducts.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                No featured items loaded. Browse categories above!
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {featuredProducts.map((prod) => (
                  <ProductCard key={prod._id} prod={prod} qty={getCartQuantity(prod._id)} addToCart={addToCart} updateQuantity={updateQuantity} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Freshly Added Products */}
        {!searchQuery && (
          <div className="space-y-4">
            <h2 className="text-[13px] font-semibold text-slate-800 tracking-wide uppercase">New Arrivals in Store</h2>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 h-56 animate-pulse"></div>
                ))}
              </div>
            ) : recentProducts.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                No items in store. Check back later!
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {recentProducts.map((prod) => (
                  <ProductCard key={prod._id} prod={prod} qty={getCartQuantity(prod._id)} addToCart={addToCart} updateQuantity={updateQuantity} />
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      <FloatingCartButton />
      <BottomNavBar activeTab="search" />
    </div>
  );
}
