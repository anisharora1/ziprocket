"use client";

import React, { useEffect, useState, useRef } from "react";
import { apiClient } from "@/services/api";
import ModeratorHeader from "@/components/moderator/ModeratorHeader";
import { useSearchParams } from "next/navigation";
import {
  MdAddBox,
  MdSearch,
  MdInventory2,
  MdImage,
  MdCheck,
  MdClose,
  MdEdit,
  MdDelete,
  MdPhotoCamera,
} from "react-icons/md";

interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  subcategory: string;
  brand: string;
  price: number;
  discountedPrice?: number;
  stockQuantity: number;
  unit: "kg" | "gram" | "litre" | "packet" | "piece";
  images: string[];
  weightSize: string;
  isAvailable: boolean;
  isFeatured: boolean;
  offerBadge?: string;
  expiryDate?: string;
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

export default function ModeratorProducts() {
  const searchParams = useSearchParams();
  
  // State variables
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("Vegetables & Fruits");
  const [subcategory, setSubcategory] = useState("Fresh Vegetables");
  const [price, setPrice] = useState("");
  const [discountedPrice, setDiscountedPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [unit, setUnit] = useState<"kg" | "gram" | "litre" | "packet" | "piece">("piece");
  const [weightSize, setWeightSize] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [offerBadge, setOfferBadge] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // In-place stock updating
  const [updatingStockId, setUpdatingStockId] = useState<string | null>(null);
  const [quickStockVal, setQuickStockVal] = useState<number>(0);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      let query = `/grocery?limit=10&page=${page}`;
      if (search) query += `&search=${encodeURIComponent(search)}`;
      if (categoryFilter) query += `&category=${encodeURIComponent(categoryFilter)}`;
      if (stockFilter === "low") query += `&lowStock=true`;
      if (stockFilter === "out") query += `&outOfStock=true`;

      const res = await apiClient.get(query);
      if (res.data.success) {
        setProducts(res.data.products);
        setTotalPages(res.data.pages || 1);
      }
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, categoryFilter, stockFilter]);

  // Handle immediate open from searchParams
  useEffect(() => {
    if (searchParams.get("action") === "new") {
      openAddModal();
    }
  }, [searchParams]);

  // Adjust subcategories when category changes
  useEffect(() => {
    const subs = CATEGORIES_MAP[category] || [];
    if (subs.length > 0 && !subs.includes(subcategory)) {
      setSubcategory(subs[0]);
    }
  }, [category]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setName("");
    setDescription("");
    setBrand("");
    setCategory("Vegetables & Fruits");
    setSubcategory("Fresh Vegetables");
    setPrice("");
    setDiscountedPrice("");
    setStockQuantity("");
    setUnit("piece");
    setWeightSize("");
    setIsAvailable(true);
    setIsFeatured(false);
    setOfferBadge("");
    setExpiryDate("");
    setImageFiles([]);
    setImagePreviews([]);
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setName(product.name || "");
    setDescription(product.description || "");
    setBrand(product.brand || "");
    setCategory(product.category || "Vegetables & Fruits");
    setSubcategory(product.subcategory || "");
    setPrice(String(product.price || ""));
    setDiscountedPrice(String(product.discountedPrice || ""));
    setStockQuantity(String(product.stockQuantity || ""));
    setUnit(product.unit || "piece");
    setWeightSize(product.weightSize || "");
    setIsAvailable(product.isAvailable !== false);
    setIsFeatured(!!product.isFeatured);
    setOfferBadge(product.offerBadge || "");
    setExpiryDate(product.expiryDate ? product.expiryDate.split("T")[0] : "");
    setImageFiles([]);
    setImagePreviews(product.images || []);
    setIsModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      // Backend limit is up to 2 files
      const selectedFiles = filesArray.slice(0, 2);
      setImageFiles(selectedFiles);

      const previews = selectedFiles.map(file => URL.createObjectURL(file));
      setImagePreviews(previews);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("brand", brand);
    formData.append("category", category);
    formData.append("subcategory", subcategory);
    formData.append("price", price);
    formData.append("discountedPrice", discountedPrice);
    formData.append("stockQuantity", stockQuantity);
    formData.append("unit", unit);
    formData.append("weightSize", weightSize);
    formData.append("isAvailable", String(isAvailable));
    formData.append("isFeatured", String(isFeatured));
    formData.append("offerBadge", offerBadge);
    if (expiryDate) {
      formData.append("expiryDate", expiryDate);
    }

    imageFiles.forEach(file => {
      formData.append("images", file);
    });

    try {
      let res;
      if (editingProduct) {
        res = await apiClient.put(`/grocery/${editingProduct._id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      } else {
        res = await apiClient.post("/grocery", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      }

      if (res.data.success) {
        setIsModalOpen(false);
        fetchProducts();
      } else {
        alert("Failed to save product: " + res.data.message);
      }
    } catch (error: any) {
      console.error("Save error:", error);
      alert(error.response?.data?.message || "An error occurred while saving product");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm("Are you sure you want to permanently delete this product? This action is irreversible.")) {
      return;
    }

    try {
      const res = await apiClient.delete(`/grocery/${productId}`);
      if (res.data.success) {
        fetchProducts();
      }
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete product");
    }
  };

  const handleQuickStockUpdate = async (productId: string) => {
    try {
      const res = await apiClient.put(`/grocery/${productId}`, {
        stockQuantity: quickStockVal
      });
      if (res.data.success) {
        setProducts(products.map(p => p._id === productId ? { ...p, stockQuantity: quickStockVal } : p));
        setUpdatingStockId(null);
      }
    } catch (error) {
      console.error("Quick stock update failed:", error);
      alert("Failed to update stock quantity.");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <ModeratorHeader title="Grocery Product Catalog" />

      <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 overflow-y-auto">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-none">Catalog Desk</h2>
            <p className="text-xs font-semibold text-slate-400 mt-2 uppercase tracking-widest">
              Live Blinkit / Zepto Hyperlocal Inventory Manager
            </p>
          </div>
          <button 
            onClick={openAddModal}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[13px] rounded-2xl shadow-lg shadow-emerald-600/10 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 self-start sm:self-auto"
          >
            <MdAddBox className="text-[20px]" />
            Add Product
          </button>
        </div>

        {/* Filters and Search */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
          <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 flex bg-slate-50 border-2 border-slate-200/60 rounded-2xl overflow-hidden focus-within:border-emerald-500 transition-colors">
              <MdSearch className="text-slate-400 text-[20px] ml-4 my-auto shrink-0" />
              <input 
                type="text" 
                placeholder="Search products by name or brand..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full py-3 px-3 bg-transparent text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {/* Category Filter */}
            <div className="w-full lg:w-60 bg-slate-50 border-2 border-slate-200/60 rounded-2xl overflow-hidden px-4 py-1.5 focus-within:border-emerald-500">
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Category</label>
              <select 
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value="">All Categories</option>
                {Object.keys(CATEGORIES_MAP).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Stock Level Filter */}
            <div className="w-full lg:w-60 bg-slate-50 border-2 border-slate-200/60 rounded-2xl overflow-hidden px-4 py-1.5 focus-within:border-emerald-500">
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Stock Levels</label>
              <select 
                value={stockFilter}
                onChange={(e) => {
                  setStockFilter(e.target.value as any);
                  setPage(1);
                }}
                className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value="all">All Stock Statuses</option>
                <option value="low">Low Stock (Under 10)</option>
                <option value="out">Out of Stock (0)</option>
              </select>
            </div>

            {/* Search Submit */}
            <button 
              type="submit"
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-2xl active:scale-95 transition-all"
            >
              Filter Records
            </button>
          </form>
        </div>

        {/* Products Table */}
        <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Product Details</th>
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Hierarchy</th>
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Pricing</th>
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Stock Level</th>
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-sm font-semibold">
                      <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3"></div>
                      Loading inventory records...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-sm font-semibold">
                      <MdInventory2 className="text-[48px] text-slate-200 block mb-2 mx-auto" />
                      No products found matching these filters.
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product._id} className="hover:bg-slate-50/30 transition-colors">
                      {/* Product image and title */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/50 flex items-center justify-center overflow-hidden shrink-0">
                            {product.images && product.images[0] ? (
                              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <MdImage className="text-slate-400 text-[20px]" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800 line-clamp-1">{product.name}</p>
                            <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>Brand: {product.brand || "Local"}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                              <span>Size: {product.weightSize}</span>
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Category & Subcategory */}
                      <td className="py-4 px-6">
                        <p className="text-xs font-bold text-slate-700">{product.category}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">{product.subcategory}</p>
                      </td>

                      {/* Pricing */}
                      <td className="py-4 px-6">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-black text-slate-800">
                            ₹{product.discountedPrice ? product.discountedPrice : product.price}
                          </span>
                          {product.discountedPrice && (
                            <span className="text-xs font-bold text-slate-400 line-through">
                              ₹{product.price}
                            </span>
                          )}
                        </div>
                        {product.offerBadge && (
                          <span className="inline-block px-1.5 py-0.5 bg-red-50 text-red-600 font-extrabold text-[9px] rounded mt-1">
                            {product.offerBadge}
                          </span>
                        )}
                      </td>

                      {/* Stock inline adjusting */}
                      <td className="py-4 px-6">
                        {updatingStockId === product._id ? (
                          <div className="flex items-center gap-1.5">
                            <input 
                              type="number" 
                              className="w-16 px-2 py-1 text-xs font-bold border-2 border-emerald-500 rounded-lg text-center"
                              defaultValue={product.stockQuantity}
                              onChange={(e) => setQuickStockVal(Number(e.target.value))}
                              autoFocus
                            />
                            <button 
                              onClick={() => handleQuickStockUpdate(product._id)}
                              className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center justify-center"
                            >
                              <MdCheck className="text-[14px]" />
                            </button>
                            <button 
                              onClick={() => setUpdatingStockId(null)}
                              className="p-1 bg-slate-100 text-slate-500 rounded hover:bg-slate-200 flex items-center justify-center"
                            >
                              <MdClose className="text-[14px]" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/stock">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black ${product.stockQuantity === 0 ? 'bg-red-50 text-red-600' : product.stockQuantity < 10 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-700'}`}>
                              {product.stockQuantity} {product.unit}s
                            </span>
                            <button 
                              onClick={() => {
                                setUpdatingStockId(product._id);
                                setQuickStockVal(product.stockQuantity);
                              }}
                              className="opacity-0 group-hover/stock:opacity-100 p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded transition-all"
                              title="Quick Restock"
                            >
                              <MdEdit className="text-[16px]" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${product.isAvailable && product.stockQuantity > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${product.isAvailable && product.stockQuantity > 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                          {product.isAvailable && product.stockQuantity > 0 ? "In Stock" : "Unavailable"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => openEditModal(product)}
                            className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-100 transition-colors"
                            title="Edit Product"
                          >
                            <MdEdit className="text-[16px]" />
                          </button>
                          <button 
                            onClick={() => handleDelete(product._id)}
                            className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-colors"
                            title="Delete Product"
                          >
                            <MdDelete className="text-[16px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-slate-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:active:scale-100 transition-all active:scale-95"
                >
                  Previous
                </button>
                <button 
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:active:scale-100 transition-all active:scale-95"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white rounded-3xl sm:rounded-[32px] w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 sm:px-8 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  {editingProduct ? "Edit Product Details" : "Catalog New Grocery Item"}
                </h3>
                <p className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  All items are synced instantly to client storefront
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shrink-0 ml-2"
              >
                <MdClose className="text-[18px]" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-4 sm:space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Product Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Product Name *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Fortune Soya Health Oil"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200/70 focus:border-emerald-500 focus:bg-white rounded-2xl text-sm font-bold text-slate-800 transition-colors placeholder:text-slate-300 focus:outline-none"
                  />
                </div>

                {/* Brand */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Brand / Manufacturer *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Fortune"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200/70 focus:border-emerald-500 focus:bg-white rounded-2xl text-sm font-bold text-slate-800 transition-colors placeholder:text-slate-300 focus:outline-none"
                  />
                </div>

                {/* Category Selection */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Category *</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200/70 focus:border-emerald-500 focus:bg-white rounded-2xl text-sm font-bold text-slate-800 transition-colors focus:outline-none"
                  >
                    {Object.keys(CATEGORIES_MAP).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Subcategory Selection */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Subcategory *</label>
                  <select 
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200/70 focus:border-emerald-500 focus:bg-white rounded-2xl text-sm font-bold text-slate-800 transition-colors focus:outline-none"
                  >
                    {(CATEGORIES_MAP[category] || []).map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                {/* Price */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">M.R.P. (₹) *</label>
                  <input 
                    type="number" 
                    required
                    min={1}
                    placeholder="e.g. 150"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200/70 focus:border-emerald-500 focus:bg-white rounded-2xl text-sm font-bold text-slate-800 transition-colors placeholder:text-slate-300 focus:outline-none"
                  />
                </div>

                {/* Discounted Price */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Discounted Sale Price (₹) (Optional)</label>
                  <input 
                    type="number" 
                    min={0}
                    placeholder="e.g. 135"
                    value={discountedPrice}
                    onChange={(e) => setDiscountedPrice(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200/70 focus:border-emerald-500 focus:bg-white rounded-2xl text-sm font-bold text-slate-800 transition-colors placeholder:text-slate-300 focus:outline-none"
                  />
                </div>

                {/* Stock Quantity */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Stock Quantity *</label>
                  <input 
                    type="number" 
                    required
                    min={0}
                    placeholder="e.g. 50"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200/70 focus:border-emerald-500 focus:bg-white rounded-2xl text-sm font-bold text-slate-800 transition-colors placeholder:text-slate-300 focus:outline-none"
                  />
                </div>

                {/* Unit */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Inventory Unit *</label>
                  <select 
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as any)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200/70 focus:border-emerald-500 focus:bg-white rounded-2xl text-sm font-bold text-slate-800 transition-colors focus:outline-none"
                  >
                    <option value="piece">pieces (pcs)</option>
                    <option value="packet">packets (pkts)</option>
                    <option value="kg">kilograms (kg)</option>
                    <option value="gram">grams (g)</option>
                    <option value="litre">litres (L)</option>
                  </select>
                </div>

                {/* Weight / Package Size */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Package Weight / Volume Size *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. 1 L, 500 g, Pack of 4"
                    value={weightSize}
                    onChange={(e) => setWeightSize(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200/70 focus:border-emerald-500 focus:bg-white rounded-2xl text-sm font-bold text-slate-800 transition-colors placeholder:text-slate-300 focus:outline-none"
                  />
                </div>

                {/* Expiry Date */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Expiry Date (Optional)</label>
                  <input 
                    type="date" 
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200/70 focus:border-emerald-500 focus:bg-white rounded-2xl text-sm font-bold text-slate-800 transition-colors focus:outline-none"
                  />
                </div>

                {/* Offer Badge */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Offer Badge / Promo Text (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Buy 1 Get 1 Free, 10% OFF"
                    value={offerBadge}
                    onChange={(e) => setOfferBadge(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200/70 focus:border-emerald-500 focus:bg-white rounded-2xl text-sm font-bold text-slate-800 transition-colors placeholder:text-slate-300 focus:outline-none"
                  />
                </div>

                {/* Checkboxes */}
                <div className="flex flex-col justify-center gap-3 py-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={isAvailable}
                      onChange={(e) => setIsAvailable(e.target.checked)}
                      className="w-4.5 h-4.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <span className="text-xs font-bold text-slate-700">Available for orders</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={isFeatured}
                      onChange={(e) => setIsFeatured(e.target.checked)}
                      className="w-4.5 h-4.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <span className="text-xs font-bold text-slate-700">Show in featured catalog slider</span>
                  </label>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Product Description *</label>
                <textarea 
                  required
                  rows={3}
                  placeholder="Describe product nutritional info, usage instructions, storing storage detail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200/70 focus:border-emerald-500 focus:bg-white rounded-2xl text-sm font-bold text-slate-800 transition-colors placeholder:text-slate-300 focus:outline-none resize-none"
                />
              </div>

              {/* Product Images */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600">Product Images (Upload up to 2 images) *</label>
                <div className="flex gap-4 items-center">
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-dashed border-slate-300 flex items-center gap-2"
                  >
                    <MdPhotoCamera className="text-[18px]" />
                    Select Files
                  </button>
                  <input 
                    type="file" 
                    multiple
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <p className="text-[11px] text-slate-400 font-bold uppercase">Max 2 files, 2MB each</p>
                </div>

                {/* Previews */}
                {imagePreviews.length > 0 && (
                  <div className="flex gap-3 pt-2">
                    {imagePreviews.map((src, index) => (
                      <div key={index} className="w-20 h-20 rounded-2xl overflow-hidden border border-slate-200 relative group shadow-sm bg-slate-50">
                        <img src={src} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button 
                            type="button"
                            onClick={() => {
                              setImagePreviews(imagePreviews.filter((_, i) => i !== index));
                              setImageFiles(imageFiles.filter((_, i) => i !== index));
                            }}
                            className="w-7 h-7 bg-red-600 text-white rounded-full flex items-center justify-center"
                          >
                            <MdDelete className="text-[14px]" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[13px] rounded-2xl active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[13px] rounded-2xl shadow-lg shadow-emerald-600/10 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <span className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : editingProduct ? (
                    "Save Product Changes"
                  ) : (
                    "Add Product to Stores"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
