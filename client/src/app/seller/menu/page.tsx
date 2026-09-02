"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { MdAdd, MdEdit, MdDelete, MdClose } from "react-icons/md";

interface MenuItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  discountedPrice?: number;
  isFeatured?: boolean;
  prepTimeMinutes?: number;
  spiceLevel?: "none" | "mild" | "medium" | "hot";
  category: string;
  images: string[];
  isAvailable: boolean;
  isVeg: boolean;
}

export default function SellerMenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    discountedPrice: "",
    prepTimeMinutes: "15",
    spiceLevel: "none",
    category: "Mains",
    isAvailable: true,
    isVeg: false,
    isFeatured: false,
  });
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user || user.role !== 'seller') {
      router.push('/auth/login');
      return;
    }

    const fetchMyRestaurantAndMenu = async () => {
      try {
        const restRes = await apiClient.get('/restaurants/my-restaurant');
        if (restRes.data.success && restRes.data.restaurant) {
          const rId = restRes.data.restaurant._id;
          setRestaurantId(rId);
          fetchMenuItems(rId);
        } else {
          setIsDataLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch restaurant", err);
        setIsDataLoading(false);
      }
    };

    fetchMyRestaurantAndMenu();
  }, [user, authLoading, router]);

  const fetchMenuItems = async (rId: string) => {
    try {
      const res = await apiClient.get(`/restaurants/${rId}/menu`);
      if (res.data.success) {
        setMenuItems(res.data.menuItems);
      }
    } catch (error) {
      console.error("Error fetching menu items:", error);
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const maxAllowed = Math.max(0, 4 - existingImages.length);
      const filesArray = Array.from(e.target.files).slice(0, maxAllowed);
      setImageFiles(filesArray);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;

    const form = new FormData();
    form.append("name", formData.name);
    form.append("description", formData.description);
    form.append("price", formData.price);
    form.append("discountedPrice", formData.discountedPrice);
    form.append("isFeatured", String(formData.isFeatured));
    form.append("prepTimeMinutes", formData.prepTimeMinutes || "15");
    form.append("spiceLevel", formData.spiceLevel || "none");
    form.append("category", formData.category);
    form.append("isAvailable", String(formData.isAvailable));
    form.append("isVeg", String(formData.isVeg));
    if (removedImages.length > 0) {
      form.append("removedImages", JSON.stringify(removedImages));
    }

    imageFiles.forEach((file) => {
      form.append("images", file);
    });

    try {
      let res;
      if (editingItemId) {
        res = await apiClient.put(`/restaurants/menu/${editingItemId}`, form, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      } else {
        res = await apiClient.post(`/restaurants/${restaurantId}/menu`, form, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      }

      const data = res.data;
      if (data.success) {
        setIsModalOpen(false);
        resetForm();
        fetchMenuItems(restaurantId);
      } else {
        alert("Failed to save menu item: " + (data.message || "Unknown error"));
      }
    } catch (error: any) {
      console.error("Error saving menu item:", error);
      alert("Error saving menu item: " + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this menu item?")) return;
    try {
      const res = await apiClient.delete(`/restaurants/menu/${itemId}`);
      if (res.data.success) {
        fetchMenuItems(restaurantId!);
      } else {
        alert("Failed to delete item: " + (res.data.message || "Unknown error"));
      }
    } catch (error: any) {
      console.error("Error deleting item:", error);
      alert("Error deleting item: " + (error.response?.data?.message || error.message));
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try {
      const res = await apiClient.put(`/restaurants/menu/${item._id}`, {
        isAvailable: !item.isAvailable
      });
      if (res.data.success) {
        setMenuItems((prev) =>
          prev.map((mi) => (mi._id === item._id ? { ...mi, isAvailable: !mi.isAvailable } : mi))
        );
      }
    } catch (error) {
      console.error("Error updating availability:", error);
    }
  };

  const openEditModal = (item: MenuItem) => {
    setFormData({
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      discountedPrice: item.discountedPrice !== undefined && item.discountedPrice !== null ? item.discountedPrice.toString() : "",
      prepTimeMinutes: (item.prepTimeMinutes || 15).toString(),
      spiceLevel: item.spiceLevel || "none",
      category: item.category || "Mains",
      isAvailable: item.isAvailable,
      isVeg: item.isVeg || false,
      isFeatured: item.isFeatured || false,
    });
    setEditingItemId(item._id);
    setExistingImages(Array.isArray(item.images) ? item.images : []);
    setRemovedImages([]);
    setImageFiles([]); // Reset files as we might not upload new ones
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      discountedPrice: "",
      prepTimeMinutes: "15",
      spiceLevel: "none",
      category: "Mains",
      isAvailable: true,
      isVeg: false,
      isFeatured: false,
    });
    setExistingImages([]);
    setRemovedImages([]);
    setImageFiles([]);
    setEditingItemId(null);
  };

  if (authLoading || isDataLoading) {
    return <div className="p-8 text-center text-slate-500">Loading Menu...</div>;
  }

  if (!restaurantId) {
    return <div className="p-8 text-center text-rose-500">No restaurant found linked to your account.</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col min-h-full">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 md:mb-8 mt-2 md:mt-0">
        <div>
          <h1 className="text-[28px] md:text-[32px] font-bold text-slate-900 tracking-tight leading-none mb-2">Menu Management</h1>
          <p className="text-[13px] md:text-[15px] text-slate-500">Configure your daily offerings and item availability.</p>
        </div>
        <div>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-emerald-700 text-white rounded-lg text-[14px] font-bold shadow-sm hover:bg-emerald-800 transition-colors"
          >
            <MdAdd className="text-[18px]" />
            Add New Item
          </button>
        </div>
      </div>

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24 md:pb-8">
        
        {menuItems.map((item) => (
          <div key={item._id} className={`bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-100 overflow-hidden flex flex-col group ${!item.isAvailable ? 'opacity-80' : ''}`}>
            <div className={`h-48 relative overflow-hidden bg-slate-100 group/gallery ${!item.isAvailable ? 'grayscale' : ''}`}>
              {item.images && item.images.length > 0 ? (
                item.images.length === 1 ? (
                  <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full overflow-x-auto snap-x snap-mandatory flex no-scrollbar scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden select-none">
                    {item.images.map((imgUrl, idx) => (
                      <div key={idx} className="snap-center shrink-0 w-full h-full relative">
                        <img src={imgUrl} alt={`${item.name} - image ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">No Image</div>
              )}

              {item.images && item.images.length > 1 && (
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10 py-0.5 px-2 rounded-full bg-black/50 backdrop-blur-xs pointer-events-none">
                  <span className="text-[9px] font-bold text-white tracking-wide">{item.images.length} photos</span>
                </div>
              )}
              
              <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm border border-white/20 flex items-center gap-1.5 z-10">
                {item.discountedPrice !== undefined && item.discountedPrice !== null && Number(item.discountedPrice) > 0 ? (
                  <>
                    <span className="line-through text-slate-400 text-[11px]">₹{item.price}</span>
                    <span className="text-emerald-700 font-bold text-[12px]">₹{item.discountedPrice}</span>
                  </>
                ) : (
                  <span className="text-[12px] font-bold text-emerald-700">₹{item.price}</span>
                )}
              </div>

              {item.isFeatured && (
                <div className="absolute top-11 left-3 bg-amber-500/95 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm text-white text-[10px] font-bold flex items-center gap-1 z-10">
                  🔥 Bestseller
                </div>
              )}

              <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
                <button 
                  onClick={() => openEditModal(item)}
                  className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md text-slate-600 hover:text-emerald-600 transition-colors"
                  title="Edit Item"
                >
                  <MdEdit className="text-[16px]" />
                </button>
                <button 
                  onClick={() => handleDelete(item._id)}
                  className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md text-slate-600 hover:text-red-600 transition-colors"
                  title="Delete Item"
                >
                  <MdDelete className="text-[16px]" />
                </button>
              </div>
              
              {!item.isAvailable && (
                <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center pointer-events-none z-10">
                  <span className="px-3 py-1.5 bg-white/20 backdrop-blur-md border border-white/30 text-white text-[11px] font-bold tracking-widest uppercase rounded">Unavailable</span>
                </div>
              )}
            </div>
            
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className={`w-3 h-3 flex items-center justify-center border ${item.isVeg ? 'border-green-600' : 'border-red-600'} bg-white rounded-sm`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`}></div>
                  </div>
                  <p className="text-[10px] font-bold text-amber-600 tracking-widest uppercase">{item.category}</p>
                  {item.isFeatured && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md flex items-center gap-0.5">
                      🔥 Bestseller
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <div 
                    onClick={() => toggleAvailability(item)}
                    className={`w-10 h-5 rounded-full relative cursor-pointer shadow-inner transition-colors ${item.isAvailable ? 'bg-emerald-500' : 'bg-slate-200 border border-slate-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${item.isAvailable ? 'right-0.5' : 'left-0.5'}`}></div>
                  </div>
                  <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{item.isAvailable ? 'Available' : 'Unavailable'}</span>
                </div>
              </div>
              <h3 className="text-[16px] font-bold text-slate-900 mb-1">{item.name}</h3>
              <p className="text-[12px] text-slate-500 leading-relaxed mb-3 line-clamp-2">{item.description}</p>

              {/* Spice level and Prep time chips */}
              <div className="flex items-center gap-2 mb-2 flex-wrap mt-auto">
                <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                  ⏱️ ~{item.prepTimeMinutes || 15} min
                </span>
                {item.spiceLevel && item.spiceLevel !== "none" && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                    item.spiceLevel === "hot" 
                      ? "bg-red-50 text-red-700 border border-red-200" 
                      : item.spiceLevel === "medium" 
                      ? "bg-orange-50 text-orange-700 border border-orange-200" 
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}>
                    {item.spiceLevel === "hot" ? "🌶️🌶️🌶️ Hot" : item.spiceLevel === "medium" ? "🌶️🌶️ Medium" : "🌶️ Mild"}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Add New Item Card */}
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center min-h-[350px] group hover:bg-emerald-50 hover:border-emerald-200 transition-all"
        >
          <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-110 transition-transform">
            <MdAdd className="text-[24px]" />
          </div>
          <span className="text-[14px] font-bold text-slate-500 group-hover:text-emerald-700 transition-colors">Add New Menu Item</span>
        </button>

      </div>

      {/* Floating Action Button (Mobile Only) */}
      <button 
        onClick={() => { resetForm(); setIsModalOpen(true); }}
        className="md:hidden fixed bottom-20 right-6 w-14 h-14 bg-emerald-700 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-emerald-800 transition-colors z-40"
      >
        <MdAdd className="text-[28px]" />
      </button>

      {/* Modal for Add/Edit Menu Item */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 z-[100] flex flex-col items-center justify-center p-4 sm:p-6"
          onClick={() => setIsModalOpen(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-[540px] max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '540px' }}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              <h2 className="text-xl font-bold text-slate-800">{editingItemId ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <MdClose className="text-[20px]" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Item Name</label>
                  <input 
                    required 
                    type="text" 
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900" 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea 
                    required
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[80px] text-slate-900" 
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Price (₹)</label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      min="0"
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Discounted (₹)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      name="discountedPrice"
                      value={formData.discountedPrice}
                      onChange={handleInputChange}
                      placeholder="Optional"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Prep Time (mins)</label>
                    <input 
                      required
                      type="number" 
                      min="1"
                      name="prepTimeMinutes"
                      value={formData.prepTimeMinutes}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 text-sm" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                    <select 
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 text-sm"
                    >
                      <option value="Starters">Starters</option>
                      <option value="Mains">Mains</option>
                      <option value="Desserts">Desserts</option>
                      <option value="Beverages">Beverages</option>
                      <option value="Pizza">Pizza</option>
                      <option value="Burger">Burger</option>
                      <option value="Drinks">Drinks</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Spice Level</label>
                    <select 
                      name="spiceLevel"
                      value={formData.spiceLevel}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 text-sm"
                    >
                      <option value="none">None (Not Spicy)</option>
                      <option value="mild">Mild 🌶️</option>
                      <option value="medium">Medium 🌶️🌶️</option>
                      <option value="hot">Hot 🌶️🌶️🌶️</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Food Type</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setFormData(p => ({ ...p, isVeg: true }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border-2 text-sm font-bold ${formData.isVeg ? 'border-green-600 bg-green-50 text-green-700' : 'border-slate-200 text-slate-500'}`}>
                      <span className="w-3 h-3 border border-green-600 flex items-center justify-center rounded-sm"><span className="w-1.5 h-1.5 rounded-full bg-green-600" /></span>
                      Vegetarian
                    </button>
                    <button type="button" onClick={() => setFormData(p => ({ ...p, isVeg: false }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border-2 text-sm font-bold ${!formData.isVeg ? 'border-red-600 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500'}`}>
                      <span className="w-3 h-3 border border-red-600 flex items-center justify-center rounded-sm"><span className="w-1.5 h-1.5 rounded-full bg-red-600" /></span>
                      Non-Vegetarian
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Upload Images (Max 4, 2MB each)</label>

                  {existingImages.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-slate-600 mb-1.5">Current Images ({existingImages.length}/4)</p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {existingImages.map((imgUrl, idx) => (
                          <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shrink-0 group">
                            <img src={imgUrl} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                setRemovedImages(prev => [...prev, imgUrl]);
                                setExistingImages(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-md hover:bg-red-700 transition-colors"
                              title="Remove image"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <input 
                    type="file" 
                    multiple 
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={existingImages.length >= 4}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-slate-900 disabled:opacity-50" 
                  />
                  {imageFiles.length > 0 && (
                    <p className="text-xs text-emerald-600 mt-1">{imageFiles.length} new file(s) selected</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="isAvailable" 
                      checked={formData.isAvailable}
                      onChange={(e) => setFormData(prev => ({ ...prev, isAvailable: e.target.checked }))}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <label htmlFor="isAvailable" className="text-sm text-slate-700 cursor-pointer">Currently Available</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="isFeatured" 
                      checked={formData.isFeatured}
                      onChange={(e) => setFormData(prev => ({ ...prev, isFeatured: e.target.checked }))}
                      className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                    />
                    <label htmlFor="isFeatured" className="text-sm text-slate-700 cursor-pointer flex items-center gap-1 font-medium">
                      🔥 Mark as Bestseller / Famous Item
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  {editingItemId ? 'Update Item' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
    </div>
  );
}
