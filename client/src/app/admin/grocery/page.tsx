"use client";

import React, { useEffect, useState, useRef } from "react";
import { apiClient } from "@/services/api";
import { MdSearch, MdImage } from "react-icons/md";

interface Product {
  _id: string;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  price: number;
  discountedPrice?: number;
  stockQuantity: number;
  unit: string;
  images: string[];
  weightSize: string;
  isAvailable: boolean;
}

export default function AdminGroceryAuditor() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [stats, setStats] = useState({ totalProducts: 0, lowStock: 0, valuation: 0 });
  const tableRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      let query = `/grocery?limit=20&page=${page}`;
      if (search) query += `&search=${encodeURIComponent(search)}`;
      if (category) query += `&category=${encodeURIComponent(category)}`;
      if (lowStockOnly) query += `&lowStock=true`;

      const [productsRes, statsRes] = await Promise.all([
        apiClient.get(query),
        apiClient.get("/grocery/stats")
      ]);

      if (productsRes.data.success) {
        setProducts(productsRes.data.products);
        setMeta({ total: productsRes.data.total, pages: productsRes.data.pages });
      }

      if (statsRes.data.success) {
        setStats({
          totalProducts: statsRes.data.stats.totalProducts,
          lowStock: statsRes.data.stats.lowStockProducts,
          valuation: statsRes.data.stats.totalValuation
        });
      }
    } catch (err) {
      console.error("Failed to load audit catalog:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [category, page, lowStockOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  return (
    <div className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Grocery Audit Desk</h2>
          <p className="text-xs font-semibold text-slate-400 mt-2 uppercase tracking-widest">
            Read-only global inventory controller for quick commerce
          </p>
        </div>

        {/* Stats pill */}
        <div className="flex gap-4">
          <div className="bg-white border border-slate-200/50 rounded-2xl px-4 py-2 text-center shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Valuation</p>
            <p className="text-sm font-black text-slate-800">₹{stats.valuation?.toLocaleString()}</p>
          </div>
          <div className="bg-white border border-slate-200/50 rounded-2xl px-4 py-2 text-center shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Catalog</p>
            <p className="text-sm font-black text-slate-800">{stats.totalProducts} items</p>
          </div>
          <div 
            onClick={() => {
              setLowStockOnly(true);
              setPage(1);
              tableRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            className="bg-white border border-slate-200/50 rounded-2xl px-4 py-2 text-center shadow-sm cursor-pointer hover:border-red-300 hover:shadow-md transition-all active:scale-95"
            title="Click to view low stock products"
          >
            <p className="text-[10px] font-bold text-red-500 uppercase">Low Stock</p>
            <p className="text-sm font-black text-red-600">{stats.lowStock} alerts</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 flex items-center bg-slate-50 border-2 border-slate-200/60 rounded-2xl overflow-hidden focus-within:border-primary-container/60 transition-colors px-4">
            <MdSearch className="text-slate-400 text-[20px] shrink-0 mr-2" />
            <input 
              type="text" 
              placeholder="Search global items by brand, category, or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full py-3 bg-transparent text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          <div className="w-full lg:w-60 bg-slate-50 border-2 border-slate-200/60 rounded-2xl overflow-hidden px-4 py-1.5 focus-within:border-primary-container/60">
            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Filter Category</label>
            <select 
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
            >
              <option value="">All Categories</option>
              <option value="Vegetables & Fruits">Vegetables & Fruits</option>
              <option value="Dairy & Bread">Dairy & Bread</option>
              <option value="Atta, Rice & Dals">Atta & Flours</option>
              <option value="Munchies">Munchies</option>
              <option value="Cold Drinks & Juices">Cold Drinks & Juices</option>
              <option value="Household Essentials">Household Essentials</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setLowStockOnly((v) => !v);
              setPage(1);
            }}
            className={`py-3 px-5 rounded-2xl text-[13px] font-extrabold transition-colors border-2 shrink-0 ${
              lowStockOnly
                ? "bg-amber-50 border-amber-300 text-amber-700"
                : "bg-slate-50 border-slate-200/60 text-slate-500"
            }`}
          >
            ⚠️ Low Stock Only
          </button>

          <button 
            type="submit"
            className="py-3 px-6 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-[13px] rounded-2xl transition-colors"
          >
            Audit Search
          </button>
        </form>
      </div>

      {/* Read Only Data Desk */}
      <div ref={tableRef} className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-sm shadow-sm">
              <tr className="bg-slate-50/50">
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Product details</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Category Area</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Price Structure</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Availability</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Current Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs font-semibold">
                    <div className="w-6 h-6 border-3 border-slate-200 border-t-primary-container rounded-full animate-spin mx-auto mb-2"></div>
                    Loading audit records...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs font-semibold">
                    No grocery products found in stores.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product._id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200/50 overflow-hidden flex items-center justify-center shrink-0">
                          {product.images && product.images[0] ? (
                            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <MdImage className="text-slate-400 text-[18px]" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-extrabold text-slate-800 line-clamp-1">{product.name}</p>
                          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{product.brand || "Generic"} • {product.weightSize}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-xs font-bold text-slate-700">{product.category}</p>
                      <p className="text-[9px] font-bold text-slate-400">{product.subcategory}</p>
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-700 font-bold">
                      ₹{product.discountedPrice || product.price}
                      {product.discountedPrice && (
                        <span className="text-[10px] text-slate-400 line-through pl-1.5">₹{product.price}</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black ${product.isAvailable && product.stockQuantity > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {product.isAvailable && product.stockQuantity > 0 ? "LIVE" : "UNAVAILABLE"}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${product.stockQuantity === 0 ? 'bg-red-50 text-red-600' : product.stockQuantity < 10 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-700'}`}>
                        {product.stockQuantity} {product.unit}s
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {!loading && meta.pages > 1 && (
        <div className="flex items-center justify-between px-2 py-4">
          <span className="text-[12px] font-semibold text-slate-500">
            Page {page} of {meta.pages} · {meta.total} total items
          </span>
          <div className="flex gap-2">
            <button 
              onClick={() => setPage((p) => Math.max(1, p - 1))} 
              disabled={page <= 1} 
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 shadow-sm transition-colors"
            >
              Previous
            </button>
            <button 
              onClick={() => setPage((p) => Math.min(meta.pages, p + 1))} 
              disabled={page >= meta.pages} 
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 shadow-sm transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

