"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import Header from "@/components/Header";
import BottomNavBar from "@/components/BottomNavBar";
import FloatingCartButton from "@/components/FloatingCartButton";
import OptimizedImage from "@/components/OptimizedImage";
import { apiClient } from "@/services/api";
import { useCart } from "@/context/CartContext";
import { usePlatform } from "@/context/PlatformContext";
import { useSocket } from "@/context/SocketContext";
import { isWithinOperatingHours, formatToAMPM } from "@/utils/restaurantHours";
import {
  MdArrowBack,
  MdFavoriteBorder,
  MdFavorite,
  MdStar,
  MdStore,
  MdInfo,
  MdEngineering,
  MdError,
  MdRestaurantMenu,
  MdAdd,
  MdRemove,
  MdSearch,
  MdClose,
  MdLocationOn,
  MdAccessTime,
  MdTwoWheeler,
  MdShare,
  MdImage,
  MdChevronRight,
  MdCheckCircle,
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
}

interface RestaurantDetailClientProps {
  initialRestaurant: any;
  initialMenuItems: MenuItemType[];
  restaurantId: string;
}

export default function RestaurantDetailClient({
  initialRestaurant,
  initialMenuItems,
  restaurantId,
}: RestaurantDetailClientProps) {
  const router = useRouter();
  const { cart, addToCart, updateQuantity } = useCart();
  const { settings, isPlatformCurrentlyOpen, getPlatformStatusMessage } = usePlatform();
  const { socket } = useSocket();

  const [restaurant, setRestaurant] = useState<any>(initialRestaurant || null);
  const [menuItems, setMenuItems] = useState<MenuItemType[]>(initialMenuItems || []);
  const [loading, setLoading] = useState<boolean>(
    !initialRestaurant && (!initialMenuItems || initialMenuItems.length === 0)
  );

  // Filter & Search states
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [vegOnly, setVegOnly] = useState<boolean>(false);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<MenuItemType | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Real-time status update via socket
  useEffect(() => {
    if (!socket) return;
    const handleStatusUpdate = (data: {
      restaurantId: string;
      availabilityStatus: string;
      isActive: boolean;
    }) => {
      if (data.restaurantId === restaurantId) {
        setRestaurant((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            availabilityStatus: data.availabilityStatus,
            isActive: data.isActive,
          };
        });
      }
    };
    socket.on("restaurant_status_updated", handleStatusUpdate);
    return () => {
      socket.off("restaurant_status_updated", handleStatusUpdate);
    };
  }, [socket, restaurantId]);

  // Background refresh for fresh data
  useEffect(() => {
    const fetchData = async () => {
      if (!initialRestaurant) {
        setLoading(true);
      }
      try {
        const [restRes, menuRes] = await Promise.allSettled([
          apiClient.get(`/restaurants/${restaurantId}`),
          apiClient.get(`/restaurants/${restaurantId}/menu`),
        ]);

        if (restRes.status === "fulfilled" && restRes.value.data.success) {
          setRestaurant(restRes.value.data.restaurant);
        }
        if (menuRes.status === "fulfilled" && menuRes.value.data.success) {
          setMenuItems(menuRes.value.data.menuItems || []);
        }
      } catch (err) {
        console.error("[Restaurant Details] Background refresh failed:", err);
      } finally {
        setLoading(false);
      }
    };

    if (restaurantId) fetchData();
  }, [restaurantId, initialRestaurant]);

  // Handle ESC to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedItem(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const categories = useMemo(() => {
    return Array.from(
      new Set((menuItems || []).map((item) => item.category).filter(Boolean) as string[])
    );
  }, [menuItems]);

  // Filtered menu items based on veg filter and search query
  const filteredMenuItems = useMemo(() => {
    return (menuItems || []).filter((item) => {
      if (vegOnly && !item.isVeg) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        const matchesCat = item.category?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesCat) return false;
      }
      return true;
    });
  }, [menuItems, vegOnly, searchQuery]);

  // Group filtered items by category
  const groupedItems = useMemo(() => {
    return filteredMenuItems.reduce((acc, item) => {
      const cat = item.category || "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, MenuItemType[]>);
  }, [filteredMenuItems]);

  const displayedCategories = useMemo(() => {
    if (activeCategory !== "All") {
      return categories.filter((c) => c === activeCategory && (groupedItems[c] || []).length > 0);
    }
    return categories.filter((c) => (groupedItems[c] || []).length > 0);
  }, [categories, activeCategory, groupedItems]);

  const scrollToCategory = (category: string) => {
    setActiveCategory(category);
    if (category === "All") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const element = document.getElementById(`category-${category}`);
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const getCartQuantity = (itemId: string) => {
    const found = cart.items.find((i) => i.id === `food-${itemId}`);
    return found ? found.quantity : 0;
  };

  const getEffectivePrice = (item: MenuItemType) => {
    if (item.discountedPrice && Number(item.discountedPrice) > 0) {
      return Number(item.discountedPrice);
    }
    return Number(item.price);
  };

  const handleAddItem = (item: MenuItemType, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!restaurant) return;

    addToCart({
      item: {
        id: `food-${item._id}`,
        name: item.name,
        price: getEffectivePrice(item),
        quantity: 1,
        img: item.images && item.images[0] ? item.images[0] : "",
      },
      vendorId: restaurantId,
      vendorName: restaurant.name,
      orderType: "food",
    });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: restaurant?.name || "ZipRocket Restaurant",
          text: `Check out the menu at ${restaurant?.name} on ZipRocket!`,
          url: window.location.href,
        });
      } catch {
        // Fallback copy
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Check ordering availability
  const isWithinHours = isWithinOperatingHours(
    restaurant?.operatingHours?.open,
    restaurant?.operatingHours?.close
  );
  const isRestaurantOpen =
    restaurant &&
    restaurant.isActive !== false &&
    restaurant.availabilityStatus === "open" &&
    isWithinHours;
  const platformMsg = getPlatformStatusMessage();
  const isOrderingDisabled = !!platformMsg || !isRestaurantOpen;

  const openTimeFormatted = restaurant?.operatingHours?.open
    ? formatToAMPM(restaurant.operatingHours.open)
    : "";
  const closeTimeFormatted = restaurant?.operatingHours?.close
    ? formatToAMPM(restaurant.operatingHours.close)
    : "";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] w-full flex flex-col font-sans">
        <Header />
        <div className="pt-20 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="h-6 w-48 bg-slate-200 rounded-lg animate-pulse"></div>
          {/* Hero skeleton */}
          <div className="h-64 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm animate-pulse flex flex-col justify-between">
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-3 w-2/3">
                <div className="h-8 bg-slate-200 rounded-xl w-3/4"></div>
                <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                <div className="h-4 bg-slate-100 rounded w-2/3"></div>
              </div>
              <div className="w-36 h-36 bg-slate-200 rounded-2xl shrink-0"></div>
            </div>
            <div className="flex gap-3">
              <div className="h-8 w-28 bg-slate-200 rounded-full"></div>
              <div className="h-8 w-28 bg-slate-200 rounded-full"></div>
            </div>
          </div>
          {/* Grid skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-72 bg-white rounded-2xl border border-slate-100 p-4 animate-pulse space-y-3">
                <div className="h-36 bg-slate-100 rounded-xl w-full"></div>
                <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                <div className="h-6 bg-slate-100 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex flex-col font-sans">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center pt-24">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
            <MdStore className="text-4xl text-slate-400" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Restaurant Unavailable</h2>
          <p className="text-slate-500 max-w-md mb-6 text-sm">
            We couldn't find the restaurant you are looking for or it may have been temporarily deactivated.
          </p>
          <Link
            href="/restaurants"
            className="px-6 py-3 bg-[#FF5C00] hover:bg-[#e05200] text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
          >
            Explore Other Restaurants
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#fcfcfc] text-on-surface min-h-screen w-full font-sans flex flex-col pb-32">
      {/* Universal Desktop & Mobile Header */}
      <Header />

      <main className="pt-16 sm:pt-20 mt-1 sm:mt-2 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 space-y-3.5 sm:space-y-6 flex-1">
        {/* Breadcrumb Navigation & Action Row */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 py-1 sm:py-2">
          {/* Mobile Back Header (< md) */}
          <div className="flex md:hidden items-center gap-2 min-w-0 flex-1">
            <Link
              href="/restaurants"
              className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:text-[#FF5C00] transition-colors shrink-0 shadow-2xs active:scale-95"
              aria-label="Back to restaurants"
            >
              <MdArrowBack className="text-lg" />
            </Link>
            <span className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
              {restaurant.name}
            </span>
          </div>

          {/* Desktop Breadcrumb (>= md) */}
          <div className="hidden md:flex items-center gap-2 text-xs sm:text-sm text-slate-500 font-medium truncate flex-1">
            <Link href="/" className="hover:text-[#FF5C00] transition-colors flex items-center gap-1 shrink-0">
              Home
            </Link>
            <MdChevronRight className="text-slate-400 shrink-0" />
            <Link href="/restaurants" className="hover:text-[#FF5C00] transition-colors shrink-0">
              Restaurants
            </Link>
            <MdChevronRight className="text-slate-400 shrink-0" />
            <span className="text-slate-900 font-bold truncate">{restaurant.name}</span>
          </div>

          {/* Share & Favorite Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={handleShare}
              title="Share restaurant"
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <MdShare className="text-base text-slate-500" />
              <span className="hidden sm:inline">{copied ? "Link Copied!" : "Share"}</span>
            </button>
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              title={isFavorite ? "Remove favorite" : "Add to favorites"}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer ${isFavorite
                ? "border-rose-200 bg-rose-50 text-rose-600"
                : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
            >
              {isFavorite ? (
                <MdFavorite className="text-base text-rose-500" />
              ) : (
                <MdFavoriteBorder className="text-base text-slate-500" />
              )}
              <span className="hidden sm:inline">{isFavorite ? "Favorited" : "Favorite"}</span>
            </button>
          </div>
        </div>

        {/* Restaurant Hero Card (Responsive for Desktop & Mobile) */}
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-4 sm:p-6 lg:p-8 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
            {/* Details Section */}
            <div className="space-y-3 sm:space-y-4 flex-1">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                    {restaurant.name}
                  </h1>
                  {restaurant.isVerified && (
                    <span title="Verified Restaurant" className="text-[#FF5C00] flex items-center">
                      <MdCheckCircle className="text-lg sm:text-xl" />
                    </span>
                  )}
                </div>

                {restaurant.cuisines && (
                  <p className="text-xs sm:text-sm font-semibold text-slate-500">
                    {Array.isArray(restaurant.cuisines)
                      ? restaurant.cuisines.join(" • ")
                      : restaurant.cuisines}
                  </p>
                )}

                <div className="flex items-start gap-1.5 text-xs text-slate-500 mt-1.5">
                  <MdLocationOn className="text-base text-[#FF5C00] shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    {restaurant.location?.address || "Address not provided"}
                  </span>
                </div>
              </div>

              {/* Status and Information Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {/* Rating Badge */}
                <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-amber-50 border border-amber-200/80">
                  <MdStar className="text-amber-500 text-sm" />
                  <span className="text-xs font-black text-amber-900">
                    {restaurant.rating > 0 ? restaurant.rating.toFixed(1) : "New"}
                  </span>
                  <span className="text-[10px] font-bold text-amber-700/80">Rating</span>
                </div>

                {/* Orders Badge */}
                <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                  <MdStore className="text-slate-400 text-sm" />
                  <span className="text-xs font-bold text-slate-800">
                    {restaurant.totalOrders ? `${restaurant.totalOrders}+` : "100+"}
                  </span>
                  <span className="text-[10px] font-medium text-slate-500">Orders</span>
                </div>

                {/* Status Pill */}
                <div
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border text-xs font-bold ${settings?.maintenanceMode
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : isRestaurantOpen
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-red-50 border-red-200 text-red-700"
                    }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${settings?.maintenanceMode
                      ? "bg-rose-600 animate-ping"
                      : isRestaurantOpen
                        ? "bg-emerald-500"
                        : "bg-red-500"
                      }`}
                  />
                  {settings?.maintenanceMode
                    ? "Maintenance"
                    : isRestaurantOpen
                      ? "Open Now"
                      : restaurant.availabilityStatus === "disabled"
                        ? "Disabled"
                        : "Closed"}
                </div>
              </div>
            </div>

            {/* Right Column: Restaurant Image (Hidden on Mobile) */}
            <div className="hidden md:flex shrink-0 justify-end">
              <div className="relative w-56 lg:w-64 h-40 sm:h-44 rounded-2xl overflow-hidden shadow-sm border border-slate-100 bg-slate-50">
                <OptimizedImage
                  src={
                    restaurant.image ||
                    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800"
                  }
                  alt={restaurant.name}
                  preset="card"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src =
                      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800";
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Ordering Warning Alert Banner */}
        {isOrderingDisabled && (
          <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
            {settings?.maintenanceMode ? (
              <MdEngineering className="text-rose-600 shrink-0 text-2xl mt-0.5" />
            ) : (
              <MdError className="text-rose-600 shrink-0 text-2xl mt-0.5" />
            )}
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-rose-900">
                {settings?.maintenanceMode
                  ? "Platform Maintenance Mode"
                  : !isPlatformCurrentlyOpen()
                    ? "ZipRocket Orders Currently Closed"
                    : "Restaurant Currently Unavailable"}
              </h4>
              <p className="text-xs text-rose-700 leading-relaxed font-medium">
                {platformMsg ||
                  (restaurant?.availabilityStatus === "disabled"
                    ? "This restaurant is temporarily disabled by administration."
                    : !isWithinHours && openTimeFormatted
                      ? `This restaurant is currently closed. It reopens at ${openTimeFormatted}.`
                      : "This restaurant is currently closed and not accepting online orders right now.")}
              </p>
            </div>
          </div>
        )}

        {/* Main Content Layout: 2-Column Desktop Grid */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-start">
          {/* Left Column: Desktop Sticky Category Sidebar */}
          <aside className="hidden lg:block lg:col-span-3 sticky top-24 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs p-4 space-y-3">
              <h3 className="font-extrabold text-sm text-slate-900 tracking-tight px-1">
                Menu Categories
              </h3>
              <div className="space-y-1">
                <button
                  onClick={() => scrollToCategory("All")}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${activeCategory === "All"
                    ? "bg-[#FF5C00] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                >
                  <span>All Dishes</span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${activeCategory === "All" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                      }`}
                  >
                    {filteredMenuItems.length}
                  </span>
                </button>

                {categories.map((cat) => {
                  const count = (groupedItems[cat] || []).length;
                  if (count === 0 && searchQuery) return null;

                  return (
                    <button
                      key={cat}
                      onClick={() => scrollToCategory(cat)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${activeCategory === cat
                        ? "bg-[#FF5C00] text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                    >
                      <span className="truncate pr-2">{cat}</span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${activeCategory === cat ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                          }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Filter Box in Desktop Sidebar */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs p-4 space-y-3">
              <h4 className="font-extrabold text-xs text-slate-900 tracking-tight px-1">
                Dietary Preferences
              </h4>
              <button
                onClick={() => setVegOnly(!vegOnly)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${vegOnly
                  ? "border-green-500 bg-green-50 text-green-700 shadow-2xs"
                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${vegOnly ? "bg-green-600" : "bg-slate-300"}`} />
                  <span>Pure Vegetarian</span>
                </div>
                <span className="text-[10px] font-semibold uppercase">{vegOnly ? "Active" : "Off"}</span>
              </button>
            </div>
          </aside>

          {/* Right Column: Menu Items Area */}
          <section className="lg:col-span-9 space-y-5 sm:space-y-6">
            {/* Search & Filter Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs p-2.5 sm:p-4 space-y-2.5 sm:space-y-3 sticky top-[68px] sm:top-[72px] z-30 backdrop-blur-md bg-white/95">
              {/* Search Bar + Veg Only in ONE ROW */}
              <div className="flex items-center gap-2 w-full">
                {/* Search in Menu */}
                <div className="flex-1 min-w-0 flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200/80 focus-within:border-[#FF5C00] focus-within:ring-2 focus-within:ring-[#FF5C00]/10 transition-all">
                  <MdSearch className="text-slate-400 text-lg shrink-0" />
                  <input
                    type="text"
                    placeholder={`Search dishes in ${restaurant.name}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent outline-none text-xs sm:text-sm w-full placeholder-slate-400 text-slate-800 font-medium min-w-0"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 shrink-0"
                    >
                      <MdClose className="text-sm sm:text-base" />
                    </button>
                  )}
                </div>

                {/* Compact Veg Only Button */}
                <button
                  onClick={() => setVegOnly(!vegOnly)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0 whitespace-nowrap ${vegOnly
                    ? "border-green-600 bg-green-50 text-green-700 shadow-2xs"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${vegOnly ? "bg-green-600" : "bg-slate-300"}`} />
                  <span className="text-xs font-bold">Veg</span>
                </button>
              </div>

              {/* Mobile/Tablet Horizontal Scrollable Category Pills */}
              {categories.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-0.5 lg:hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <button
                    onClick={() => scrollToCategory("All")}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-2xs shrink-0 ${activeCategory === "All"
                      ? "bg-[#FF5C00] text-white"
                      : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                      }`}
                  >
                    All ({filteredMenuItems.length})
                  </button>
                  {categories.map((cat) => {
                    const count = (groupedItems[cat] || []).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => scrollToCategory(cat)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-2xs shrink-0 ${activeCategory === cat
                          ? "bg-[#FF5C00] text-white"
                          : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                          }`}
                      >
                        {cat} {count > 0 && `(${count})`}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Menu Items List */}
            {!menuItems || menuItems.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center flex flex-col items-center justify-center shadow-2xs">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
                  <MdRestaurantMenu className="text-4xl" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-800 mb-1">No Menu Items Available</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  This restaurant hasn't listed any dishes on their menu yet. Please check back later.
                </p>
              </div>
            ) : filteredMenuItems.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center flex flex-col items-center justify-center shadow-2xs">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3 text-slate-400">
                  <MdSearch className="text-3xl" />
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-1">No Matching Dishes Found</h3>
                <p className="text-xs text-slate-500 mb-4">
                  {vegOnly
                    ? "No pure vegetarian items match your search filter."
                    : `No dishes match "${searchQuery}".`}
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setVegOnly(false);
                    setActiveCategory("All");
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              displayedCategories.map((category) => {
                const items = groupedItems[category] || [];
                if (items.length === 0) return null;

                return (
                  <div
                    key={`category-${category}`}
                    id={`category-${category}`}
                    className="scroll-mt-36 space-y-4"
                  >
                    {/* Category Title Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        {category}
                        <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                          {items.length} {items.length === 1 ? "item" : "items"}
                        </span>
                      </h2>
                    </div>

                    {/* Responsive Grid for Food Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                      {items.map((item) => {
                        const qty = getCartQuantity(item._id);
                        const effectivePrice = getEffectivePrice(item);
                        const isItemDisabled =
                          !item.isAvailable ||
                          isOrderingDisabled ||
                          restaurant.isActive === false ||
                          restaurant.availabilityStatus !== "open";

                        return (
                          <div
                            key={item._id}
                            onClick={() => setSelectedItem(item)}
                            className={`bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(255,92,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group cursor-pointer ${!item.isAvailable ? "opacity-75" : ""
                              }`}
                          >
                            {/* Card Top: Dish Image */}
                            <div className="relative rounded-t-2xl overflow-hidden h-40 sm:h-44 bg-slate-50 shrink-0">
                              {item.images && item.images.length > 0 ? (
                                <OptimizedImage
                                  src={item.images[0]}
                                  alt={item.name}
                                  preset="card"
                                  className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${!item.isAvailable ? "grayscale" : ""
                                    }`}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src =
                                      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800";
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-50">
                                  <MdImage className="text-slate-300 text-4xl" />
                                </div>
                              )}

                              {/* Multi-photo indicator */}
                              {item.images && item.images.length > 1 && (
                                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded-full text-white text-[9px] font-bold flex items-center gap-1 z-10 pointer-events-none">
                                  <span>{item.images.length} photos</span>
                                </div>
                              )}

                              {/* Bestseller Badge */}
                              {item.isFeatured && (
                                <span className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 bg-amber-500 text-white font-black text-[9px] rounded-md shadow-sm">
                                  🔥 Bestseller
                                </span>
                              )}

                              {/* Unavailable Overlay */}
                              {!item.isAvailable && (
                                <div className="absolute inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center z-10">
                                  <span className="bg-white/95 px-3 py-1 rounded-full text-[11px] font-extrabold text-slate-800 uppercase tracking-wider shadow-sm">
                                    Unavailable
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Card Body */}
                            <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
                              <div>
                                {/* Veg marker + Category */}
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <div
                                    className={`shrink-0 w-3.5 h-3.5 flex items-center justify-center border ${item.isVeg ? "border-green-600" : "border-red-600"
                                      } bg-white rounded-[3px]`}
                                  >
                                    <div
                                      className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? "bg-green-600" : "bg-red-600"
                                        }`}
                                    />
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                                    {item.category || "Dish"}
                                  </span>
                                </div>

                                <h3 className="font-extrabold text-sm sm:text-[15px] text-slate-900 leading-snug group-hover:text-[#FF5C00] transition-colors line-clamp-1 mb-1">
                                  {item.name}
                                </h3>

                                <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-2.5 font-medium">
                                  {item.description || "Freshly cooked and prepared to order."}
                                </p>

                                {/* Tags (Prep time, Spice level) */}
                                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                                  <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    ⏱️ ~{item.prepTimeMinutes || 15}m
                                  </span>
                                  {item.spiceLevel && item.spiceLevel !== "none" && (
                                    <span
                                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-0.5 ${item.spiceLevel === "hot"
                                        ? "bg-red-50 text-red-700 border border-red-200"
                                        : item.spiceLevel === "medium"
                                          ? "bg-orange-50 text-orange-700 border border-orange-200"
                                          : "bg-amber-50 text-amber-700 border border-amber-200"
                                        }`}
                                    >
                                      {item.spiceLevel === "hot"
                                        ? "🌶️🌶️ Hot"
                                        : item.spiceLevel === "medium"
                                          ? "🌶️ Med"
                                          : "Mild"}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Card Footer: Price & Add to Cart Controls */}
                              <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 mt-auto">
                                <div className="flex items-baseline gap-1.5">
                                  <span className="font-black text-slate-900 text-sm sm:text-base">
                                    ₹{effectivePrice}
                                  </span>
                                  {item.discountedPrice &&
                                    Number(item.discountedPrice) > 0 &&
                                    item.price > item.discountedPrice && (
                                      <span className="text-[11px] font-semibold text-slate-400 line-through">
                                        ₹{item.price}
                                      </span>
                                    )}
                                </div>

                                {qty > 0 ? (
                                  <div
                                    className="flex items-center bg-white border border-[#FF5C00] rounded-xl shadow-xs overflow-hidden font-black text-xs"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={() => updateQuantity(`food-${item._id}`, qty - 1)}
                                      className="px-2.5 py-1 hover:bg-[#FF5C00]/10 text-[#FF5C00] transition-colors active:scale-90"
                                      aria-label="Decrease quantity"
                                    >
                                      <MdRemove className="text-sm" />
                                    </button>
                                    <span className="px-2 text-slate-900 font-extrabold text-xs">{qty}</span>
                                    <button
                                      onClick={() => updateQuantity(`food-${item._id}`, qty + 1)}
                                      className="px-2.5 py-1 hover:bg-[#FF5C00]/10 text-[#FF5C00] transition-colors active:scale-90"
                                      aria-label="Increase quantity"
                                    >
                                      <MdAdd className="text-sm" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => handleAddItem(item, e)}
                                    disabled={isItemDisabled}
                                    className={`h-8 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-xs flex items-center justify-center gap-1 ${isItemDisabled
                                      ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none"
                                      : "bg-white border border-[#FF5C00] text-[#FF5C00] hover:bg-[#FF5C00] hover:text-white"
                                      }`}
                                  >
                                    {!item.isAvailable ? "OOS" : "ADD"}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </div>
      </main>

      {/* Dish Item Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
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

                {!selectedItem.isAvailable && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <span className="bg-white/95 px-3 py-1 rounded-full text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Currently Unavailable
                    </span>
                  </div>
                )}
              </div>

              {/* Dish Info Body */}
              <div className="p-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className={`shrink-0 w-4 h-4 flex items-center justify-center border ${selectedItem.isVeg ? "border-green-600" : "border-red-600"
                        } bg-white rounded-sm`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${selectedItem.isVeg ? "bg-green-600" : "bg-red-600"
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

                  <p className="text-xs text-slate-500 mt-1 font-medium">from {restaurant.name}</p>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  {selectedItem.description || "Prepared with fresh ingredients and authentic flavours."}
                </p>

                {/* Additional Item Details */}
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2.5">
                    <span className="text-xl">⏱️</span>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Prep Time</p>
                      <p className="text-xs font-black text-slate-800">
                        ~{selectedItem.prepTimeMinutes || 15} minutes
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2.5">
                    <span className="text-xl">🌶️</span>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Spice Level</p>
                      <p className="text-xs font-black text-slate-800 capitalize">
                        {selectedItem.spiceLevel || "Standard"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Price and Cart Action Footer */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total Price</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-slate-900">
                        ₹{getEffectivePrice(selectedItem)}
                      </span>
                      {selectedItem.discountedPrice &&
                        Number(selectedItem.discountedPrice) > 0 &&
                        selectedItem.price > selectedItem.discountedPrice && (
                          <span className="text-sm font-bold text-slate-400 line-through">
                            ₹{selectedItem.price}
                          </span>
                        )}
                    </div>
                  </div>

                  {getCartQuantity(selectedItem._id) > 0 ? (
                    <div className="flex items-center bg-[#FF5C00]/10 border border-[#FF5C00] rounded-xl px-2 py-1">
                      <button
                        onClick={() =>
                          updateQuantity(
                            `food-${selectedItem._id}`,
                            getCartQuantity(selectedItem._id) - 1
                          )
                        }
                        className="w-8 h-8 rounded-lg bg-white text-[#FF5C00] font-black flex items-center justify-center hover:bg-slate-50 transition-colors shadow-2xs"
                      >
                        -
                      </button>
                      <span className="px-3 font-black text-sm text-slate-900">
                        {getCartQuantity(selectedItem._id)}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(
                            `food-${selectedItem._id}`,
                            getCartQuantity(selectedItem._id) + 1
                          )
                        }
                        className="w-8 h-8 rounded-lg bg-white text-[#FF5C00] font-black flex items-center justify-center hover:bg-slate-50 transition-colors shadow-2xs"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      disabled={
                        !selectedItem.isAvailable ||
                        isOrderingDisabled ||
                        restaurant.isActive === false ||
                        restaurant.availabilityStatus !== "open"
                      }
                      onClick={() => {
                        handleAddItem(selectedItem);
                        setSelectedItem(null);
                      }}
                      className={`px-6 py-3 rounded-xl font-black text-sm shadow-md transition-all active:scale-95 ${!selectedItem.isAvailable ||
                        isOrderingDisabled ||
                        restaurant.isActive === false ||
                        restaurant.availabilityStatus !== "open"
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                        : "bg-[#FF5C00] hover:bg-[#e05200] text-white shadow-[#FF5C00]/25"
                        }`}
                    >
                      Add To Cart
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Cart Button for mobile & desktop */}
      <FloatingCartButton />

      {/* Bottom Nav Bar (Mobile only) */}
      <BottomNavBar activeTab="menu" />
    </div>
  );
}
