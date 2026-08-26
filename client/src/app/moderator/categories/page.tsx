"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/api";
import ModeratorHeader from "@/components/moderator/ModeratorHeader";
import { MdCategory, MdKeyboardArrowDown } from "react-icons/md";

import { GROCERY_CATEGORIES_MAP } from "@/lib/groceryCategories";

interface Product {
  _id: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  stockQuantity: number;
}

export default function ModeratorCategories() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>("Vegetables & Fruits");

  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        setLoading(true);
        let allProducts: Product[] = [];
        let currentPage = 1;
        let totalPages = 1;

        do {
          const res = await apiClient.get(`/grocery?limit=100&page=${currentPage}`);
          if (res.data.success) {
            allProducts = allProducts.concat(res.data.products || []);
            totalPages = res.data.pages || 1;
            currentPage++;
          } else {
            break;
          }
        } while (currentPage <= totalPages);

        setProducts(allProducts);
      } catch (error) {
        console.error("Failed to load category counts:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllProducts();
  }, []);

  const getStats = (cat: string, sub?: string) => {
    let list = products.filter(p => p.category === cat);
    if (sub) {
      list = list.filter(p => p.subcategory === sub);
    }
    const count = list.length;
    const stock = list.reduce((sum, p) => sum + p.stockQuantity, 0);
    return { count, stock };
  };

  const knownCategories = new Set(Object.keys(GROCERY_CATEGORIES_MAP));
  const uncategorizedProducts = products.filter(p => !knownCategories.has(p.category));

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <ModeratorHeader title="Categories & Subcategories" />
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-semibold text-slate-500">Mapping categories...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <ModeratorHeader title="Categories & Subcategories" />

      <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 overflow-y-auto">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-none">Category Deck</h2>
          <p className="text-xs font-semibold text-slate-400 mt-2 uppercase tracking-widest">
            Audit standard quick-commerce categories & live subcategory distribution
          </p>
        </div>

        {/* Category Accordion */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          {Object.keys(GROCERY_CATEGORIES_MAP).map((catName) => {
            const isExpanded = expandedCategory === catName;
            const subcats = GROCERY_CATEGORIES_MAP[catName];
            const catStats = getStats(catName);

            return (
              <div 
                key={catName} 
                className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
              >
                {/* Accordion Trigger */}
                <button 
                  onClick={() => setExpandedCategory(isExpanded ? null : catName)}
                  className="w-full text-left px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      <MdCategory className="text-[20px]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800">{catName}</h3>
                      <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                        {subcats.length} subcategories
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] rounded-md mr-2">
                        {catStats.count} items
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 font-bold text-[10px] rounded-md ${catStats.stock === 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                        {catStats.stock} units total
                      </span>
                    </div>
                    <MdKeyboardArrowDown 
                      className="text-slate-400 text-[22px] transition-transform duration-200" 
                      style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }} 
                    />
                  </div>
                </button>

                {/* Subcategory List (Expanded) */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/30 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-200">
                    {subcats.map(subName => {
                      const subStats = getStats(catName, subName);
                      return (
                        <div key={subName} className="bg-white border border-slate-100/80 rounded-2xl p-4 flex flex-col justify-between hover:border-emerald-200 shadow-sm transition-all duration-300">
                          <div>
                            <h4 className="text-xs font-extrabold text-slate-800">{subName}</h4>
                            <p className="text-[10px] font-semibold text-slate-400 mt-1 uppercase tracking-wide">
                              Subcategory Area
                            </p>
                          </div>
                          
                          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100/50">
                            <span className="text-[11px] font-bold text-slate-500">
                              {subStats.count} products
                            </span>
                            <span className={`text-[11px] font-black ${subStats.stock === 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                              {subStats.stock} units
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Uncategorized Products Notice */}
        {uncategorizedProducts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg shrink-0">
                ⚠️
              </div>
              <div>
                <h4 className="text-sm font-black text-amber-900">Uncategorized Products Detected</h4>
                <p className="text-xs font-semibold text-amber-700 mt-0.5">
                  {uncategorizedProducts.length} product{uncategorizedProducts.length > 1 ? "s" : ""} have categories not defined in the standard catalog mapping.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 self-start sm:self-auto">
              {Array.from(new Set(uncategorizedProducts.map(p => p.category || "Unassigned"))).map(cat => (
                <span key={cat} className="px-2.5 py-1 bg-white border border-amber-200 text-amber-800 text-[10px] font-extrabold rounded-lg">
                  {cat}: {uncategorizedProducts.filter(p => p.category === cat).length}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
