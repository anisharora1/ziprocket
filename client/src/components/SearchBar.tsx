"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocation } from "@/context/LocationContext";
import { apiClient } from "@/services/api";
import OptimizedImage from "./OptimizedImage";
import {
  MdSearch,
  MdClose,
  MdMic,
  MdSearchOff,
  MdStorefront,
  MdStar,
  MdRestaurant,
  MdShoppingBasket,
  MdShoppingBag,
} from "react-icons/md";

interface SearchResults {
  restaurants: any[];
  groceryProducts: any[];
  menuItems: any[];
}

export default function SearchBar() {
  const router = useRouter();
  const { zoneId } = useLocation();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({
    restaurants: [],
    groceryProducts: [],
    menuItems: []
  });
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Web Speech API Voice Search
  const startVoiceSearch = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please type manually.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN"; // Configured for English and Indian accent phonetics
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const speechToText = event.results[0][0].transcript;
        if (speechToText) {
          setQuery(speechToText);
          setIsOpen(true);
        }
      };

      recognition.onerror = (err: any) => {
        console.error("Speech recognition error:", err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.error("Speech recognition initialization failed:", e);
      setIsListening(false);
    }
  };

  // Debounced search logic
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({ restaurants: [], groceryProducts: [], menuItems: [] });
      setLoading(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `/search/global?q=${encodeURIComponent(query)}${zoneId ? `&zoneId=${zoneId}` : ""}`;
        const res = await apiClient.get(url);
        if (res.data.success) {
          setResults(res.data.results || { restaurants: [], groceryProducts: [], menuItems: [] });
        }
      } catch (err) {
        console.error("Global search failed:", err);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(delayDebounce);
  }, [query, zoneId]);

  // Click-away listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim()) {
      setIsOpen(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSuggestionClick = (term: string) => {
    setQuery(term);
    setIsOpen(false);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  const clearSearch = () => {
    setQuery("");
    setResults({ restaurants: [], groceryProducts: [], menuItems: [] });
    setIsOpen(false);
  };

  const hasResults =
    results.restaurants.length > 0 ||
    results.groceryProducts.length > 0 ||
    results.menuItems.length > 0;

  return (
    <div className="pt-md pb-xs relative" ref={containerRef}>
      <div className="relative group transition-all duration-200 active:scale-[0.99]">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <MdSearch className="text-slate-400 text-xl" />
        </div>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          //onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyPress}
          className="block w-full h-14 pl-12 pr-20 bg-white border border-slate-200 rounded-xl font-label-md text-label-md focus:ring-2 focus:ring-primary-container focus:border-transparent shadow-sm outline-none text-slate-800"
          placeholder="Search for food, grocery..."
          type="text"
          suppressHydrationWarning={true}
        />
        <div className="absolute inset-y-0 right-0 pr-4 flex items-center gap-2">
          {query && (
            <button
              onClick={clearSearch}
              className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer flex items-center justify-center p-1 rounded-full hover:bg-slate-100"
            >
              <MdClose className="text-sm font-bold" />
            </button>
          )}
          <button
            type="button"
            onClick={startVoiceSearch}
            className={`flex items-center justify-center p-1.5 rounded-full hover:bg-slate-100 transition-all cursor-pointer ${isListening ? 'animate-pulse text-red-500 bg-red-50' : 'text-primary-container'}`}
            title="Search with your voice"
          >
            <MdMic className="text-xl" />
          </button>
        </div>
      </div>

      {/* Suggestion & Results Overlay */}
      {isOpen && (
        <div
          className="absolute left-0 right-0 top-full mt-2 z-50 max-h-[460px] overflow-y-auto bg-white/95 border border-slate-100 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-md custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {loading ? (
            /* Loading State Skeleton */
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded bg-slate-200 animate-pulse"></div>
                <div className="h-4 w-28 bg-slate-200 rounded animate-pulse"></div>
              </div>
              <div className="space-y-3 pl-8">
                <div className="h-6 w-3/4 bg-slate-100 rounded animate-pulse"></div>
                <div className="h-6 w-1/2 bg-slate-100 rounded animate-pulse"></div>
              </div>
            </div>
          ) : !hasResults ? (
            /* Empty State */
            <div className="text-center py-10 px-5 text-slate-400">
              <MdSearchOff className="text-4xl text-slate-200 block mb-2 mx-auto" />
              <p className="text-xs font-bold text-slate-500">No matches found for "{query}"</p>
              <p className="text-[10px] text-slate-400 mt-1">Try searching for other dishes, groceries, or cuisines.</p>
            </div>
          ) : (
            /* Search Results Display */
            <div className="divide-y divide-slate-50">
              {/* Restaurants Section */}
              {results.restaurants.length > 0 && (
                <div className="p-4">
                  <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-[#FF5C00] mb-2.5 flex items-center gap-1.5">
                    <MdStorefront className="text-[15px]" />
                    Restaurants
                  </h4>
                  <div className="space-y-2">
                    {results.restaurants.map((rest) => (
                      <div
                        key={rest._id}
                        onClick={() => {
                          setIsOpen(false);
                          router.push(`/restaurants/${rest._id}`);
                        }}
                        className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group"
                      >
                        <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-slate-800 group-hover:text-[#FF5C00] transition-colors leading-tight">
                            {rest.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium mt-0.5 leading-none">
                            {rest.cuisines || "Multi-cuisine"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 bg-green-50 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-extrabold shrink-0 border border-green-100">
                          <span>{rest.rating || "New"}</span>
                          <MdStar className="text-[10px]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Menu Items Section */}
              {results.menuItems.length > 0 && (
                <div className="p-4">
                  <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-[#FF5C00] mb-2.5 flex items-center gap-1.5">
                    <MdRestaurant className="text-[15px]" />
                    Dishes & Food
                  </h4>
                  <div className="space-y-2">
                    {results.menuItems.map((item) => (
                      <div
                        key={item._id}
                        onClick={() => {
                          setIsOpen(false);
                          const rId = item.restaurant._id || item.restaurant;
                          router.push(`/restaurants/${rId}`);
                        }}
                        className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group"
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-3 h-3 rounded flex items-center justify-center border text-[6px] font-black shrink-0 ${item.isVeg ? 'border-green-600 text-green-600' : 'border-red-600 text-red-600'}`}>
                              ●
                            </span>
                            <span className="text-[13px] font-bold text-slate-800 group-hover:text-[#FF5C00] transition-colors leading-tight">
                              {item.name}
                            </span>
                            {item.isFeatured && (
                              <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1 rounded">
                                🔥
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium mt-0.5 pl-4.5 leading-none">
                            from {item.restaurant?.name || "Local Kitchen"}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1 shrink-0 pl-2">
                          {item.discountedPrice && Number(item.discountedPrice) > 0 ? (
                            <>
                              <span className="text-[12px] font-black text-slate-700">₹{item.discountedPrice}</span>
                              <span className="text-[10px] font-semibold text-slate-400 line-through">₹{item.price}</span>
                            </>
                          ) : (
                            <span className="text-[12px] font-black text-slate-700">₹{item.price}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grocery Section */}
              {results.groceryProducts.length > 0 && (
                <div className="p-4">
                  <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-[#FF5C00] mb-2.5 flex items-center gap-1.5">
                    <MdShoppingBasket className="text-[15px]" />
                    Groceries
                  </h4>
                  <div className="space-y-2">
                    {results.groceryProducts.map((prod) => (
                      <div
                        key={prod._id}
                        onClick={() => {
                          setIsOpen(false);
                          router.push(`/grocery?q=${encodeURIComponent(prod.name)}`);
                        }}
                        className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 relative">
                            {prod.images && prod.images[0] ? (
                              <OptimizedImage src={prod.images[0]} alt={prod.name} className="w-full h-full object-contain" preset="thumbnail" />
                            ) : (
                              <MdShoppingBag className="text-slate-300 text-xs" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[13px] font-bold text-slate-800 group-hover:text-[#FF5C00] transition-colors leading-tight line-clamp-1">
                              {prod.name}
                            </span>
                            <span className="text-[9px] text-slate-400 font-medium mt-0.5 leading-none">
                              {prod.brand || "Local Brand"} • {prod.weightSize}
                            </span>
                          </div>
                        </div>
                        <span className="text-[12px] font-black text-slate-700 shrink-0 pl-2">
                          ₹{prod.discountedPrice || prod.price}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

