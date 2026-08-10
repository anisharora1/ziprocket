"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import BottomNavBar from "@/components/BottomNavBar";
import FloatingCartButton from "@/components/FloatingCartButton";
import { useCart } from "@/context/CartContext";
import { apiClient } from "@/services/api";
import Link from "next/link";
import OptimizedImage from "@/components/OptimizedImage";
import { usePlatform } from "@/context/PlatformContext";
import ProductCard from "@/components/ProductCard";
import { MdArrowBack, MdStorefront } from "react-icons/md";

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

const CATEGORIES_MAP: Record<string, string[]> = {
  "Vegetables & Fruits": ["Fresh Vegetables", "Fresh Fruits", "Herbs & Seasonings"],
  "Dairy & Bread": ["Milk & Cream", "Butter & Cheese", "Bread & Pav", "Curd & Paneer"],
  "Atta, Rice & Dals": ["Atta & Flours", "Rice & Basmati", "Dals & Pulses", "Ghee & Oils"],
  "Munchies": ["Chips & Crisps", "Bhujia & Namkeen", "Biscuits & Cookies", "Popcorn"],
  "Cold Drinks & Juices": ["Soft Drinks", "Fruit Juices", "Energy Drinks", "Soda & Mixers"],
  "Household Essentials": ["Detergents & Cleaners", "Pooja Needs", "Tissues & Disposables", "Repellents"],
  "Personal Care": ["Soaps & Bodywash", "Shampoos & Haircare", "Oral Care", "Deodorants"]
};

const SUBCATEGORY_ICONS: Record<string, string> = {
  "All": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=120&h=120&q=80",
  // Vegetables & Fruits
  "Fresh Vegetables": "https://images.unsplash.com/photo-1566385101042-1a010c129fa1?auto=format&fit=crop&w=120&h=120&q=80",
  "Fresh Fruits": "https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?auto=format&fit=crop&w=120&h=120&q=80",
  "Herbs & Seasonings": "https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&w=120&h=120&q=80",
  // Dairy & Bread
  "Milk & Cream": "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=120&h=120&q=80",
  "Butter & Cheese": "https://images.unsplash.com/photo-1486299267070-83823f5448dd?auto=format&fit=crop&w=120&h=120&q=80",
  "Bread & Pav": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=120&h=120&q=80",
  "Curd & Paneer": "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=120&h=120&q=80",
  // Atta, Rice & Dals
  "Atta & Flours": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=120&h=120&q=80",
  "Rice & Basmati": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=120&h=120&q=80",
  "Dals & Pulses": "https://images.unsplash.com/photo-1515942400420-2b98fed1f515?auto=format&fit=crop&w=120&h=120&q=80",
  "Ghee & Oils": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=120&h=120&q=80",
  // Munchies
  "Chips & Crisps": "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=120&h=120&q=80",
  "Bhujia & Namkeen": "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=120&h=120&q=80",
  "Biscuits & Cookies": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=120&h=120&q=80",
  "Popcorn": "https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=120&h=120&q=80",
  // Cold Drinks & Juices
  "Soft Drinks": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=120&h=120&q=80",
  "Fruit Juices": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=120&h=120&q=80",
  "Energy Drinks": "https://images.unsplash.com/photo-1527960656306-ff37c5699b7b?auto=format&fit=crop&w=120&h=120&q=80",
  "Soda & Mixers": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=120&h=120&q=80",
  // Household Essentials
  "Detergents & Cleaners": "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=120&h=120&q=80",
  "Pooja Needs": "https://images.unsplash.com/photo-1609137144813-90d1bf4f9e8a?auto=format&fit=crop&w=120&h=120&q=80",
  "Tissues & Disposables": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=120&h=120&q=80",
  "Repellents": "https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?auto=format&fit=crop&w=120&h=120&q=80",
  // Personal Care
  "Soaps & Bodywash": "https://images.unsplash.com/photo-1607006342411-92346cf57b4e?auto=format&fit=crop&w=120&h=120&q=80",
  "Shampoos & Haircare": "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=120&h=120&q=80",
  "Oral Care": "https://images.unsplash.com/photo-1559599101-f09722fb4925?auto=format&fit=crop&w=120&h=120&q=80",
  "Deodorants": "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=120&h=120&q=80"
};

export default function CategoryProductsPage() {
  const { categoryName } = useParams();
  const router = useRouter();
  const { addToCart, cart, updateQuantity } = useCart();

  const decodedCategory = decodeURIComponent(categoryName as string);
  const subcategories = CATEGORIES_MAP[decodedCategory] || [];

  const [activeSub, setActiveSub] = useState<string>("All");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategoryProducts = async () => {
    try {
      setLoading(true);
      let query = `/grocery?category=${encodeURIComponent(decodedCategory)}&limit=40`;
      if (activeSub !== "All") {
        query += `&subcategory=${encodeURIComponent(activeSub)}`;
      }

      const res = await apiClient.get(query);
      if (res.data.success) {
        setProducts(res.data.products);
      }
    } catch (err) {
      console.error("Failed to load category products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (decodedCategory) {
      fetchCategoryProducts();
    }
  }, [decodedCategory, activeSub]);

  const getCartQuantity = (productId: string) => {
    const item = cart.items.find(i => i.id === `groc-${productId}`);
    return item ? item.quantity : 0;
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen w-full font-['Plus_Jakarta_Sans'] flex flex-col h-[100dvh]">
      <Header />

      {/* Main Split View */}
      <div className="flex flex-1 overflow-hidden bg-slate-50 mt-16 max-w-7xl mx-auto w-full border-x border-slate-100/60 shadow-sm relative">

        {/* Left Subcategory Rail */}
        <div className="w-[100px] md:w-[150px] shrink-0 bg-white border-r border-slate-100 overflow-y-auto hide-scrollbar flex flex-col">
          <div className="p-3 border-b border-slate-50 shrink-0">
            <Link
              href="/grocery"
              className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-[#FF5C00] transition-colors uppercase tracking-widest"
            >
              <MdArrowBack className="text-[14px]" />
              Grocery
            </Link>
          </div>

          <button
            onClick={() => setActiveSub("All")}
            className={`flex flex-col md:flex-row items-center py-3 px-2 gap-2 border-l-[4px] transition-all text-left cursor-pointer ${activeSub === "All" ? 'bg-[#FFF1E6]/40 border-l-[#FF5C00]' : 'bg-white border-l-transparent hover:bg-slate-50'}`}
          >
            <div className="w-8 h-8 rounded-full border border-slate-100 overflow-hidden flex items-center justify-center bg-white shrink-0 shadow-sm transition-transform group-hover:scale-105">
              <OptimizedImage src={SUBCATEGORY_ICONS["All"]} alt="All" preset="thumbnail" className="w-full h-full object-cover" />
            </div>
            <span className={`text-[10px] md:text-[11px] leading-tight tracking-tight font-sans text-center md:text-left ${activeSub === "All" ? 'font-black text-[#FF5C00]' : 'font-semibold text-slate-500'}`}>
              All Items
            </span>
          </button>

          {subcategories.map((sub) => {
            const isActive = activeSub === sub;
            const subIcon = SUBCATEGORY_ICONS[sub] || SUBCATEGORY_ICONS["All"];
            return (
              <button
                key={sub}
                onClick={() => setActiveSub(sub)}
                className={`flex flex-col md:flex-row items-center py-3 px-2 gap-2 border-l-[4px] transition-all text-left cursor-pointer ${isActive ? 'bg-[#FFF1E6]/40 border-l-[#FF5C00]' : 'bg-white border-l-transparent hover:bg-slate-50'}`}
              >
                <div className="w-8 h-8 rounded-full border border-slate-100 overflow-hidden flex items-center justify-center bg-white shrink-0 shadow-sm transition-transform group-hover:scale-105">
                  <OptimizedImage src={subIcon} alt={sub} preset="thumbnail" className="w-full h-full object-cover" />
                </div>
                <span className={`text-[10px] md:text-[11px] leading-tight tracking-tight font-sans text-center md:text-left ${isActive ? 'font-black text-[#FF5C00]' : 'font-semibold text-slate-500'}`}>
                  {sub}
                </span>
              </button>
            )
          })}
        </div>

        {/* Right Content Grid */}
        <div className="flex-1 bg-slate-50 overflow-y-auto p-4 hide-scrollbar">
          <div className="mb-4">
            <h2 className="text-lg font-black text-slate-900 leading-none">{decodedCategory}</h2>
            <p className="text-[11px] font-semibold text-slate-400 mt-1.5 uppercase tracking-wider">{activeSub} catalog area</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-20">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 h-56 animate-pulse"></div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs font-bold flex flex-col items-center">
              <MdStorefront className="text-[48px] text-slate-200 block mb-2" />
              No products found in this category yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-24">
              {products.map((prod) => (
                <ProductCard key={prod._id} prod={prod} qty={getCartQuantity(prod._id)} addToCart={addToCart} updateQuantity={updateQuantity} />
              ))}
            </div>
          )}
        </div>
      </div>

      <FloatingCartButton />
      <BottomNavBar activeTab="search" />
    </div>
  );
}



