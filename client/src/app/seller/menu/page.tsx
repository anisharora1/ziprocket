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
    category: "Mains",
    isAvailable: true,
    isVeg: false,
  });
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
      const filesArray = Array.from(e.target.files).slice(0, 2); // Max 2 files
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
    form.append("category", formData.category);
    form.append("isAvailable", String(formData.isAvailable));
    form.append("isVeg", String(formData.isVeg));

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
      category: item.category || "Mains",
      isAvailable: item.isAvailable,
      isVeg: item.isVeg || false,
    });
    setEditingItemId(item._id);
    setImageFiles([]); // Reset files as we might not upload new ones
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      category: "Mains",
      isAvailable: true,
      isVeg: false,
    });
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
            <div className={`h-48 relative overflow-hidden bg-slate-100 ${!item.isAvailable ? 'grayscale' : ''}`}>
              {item.images && item.images.length > 0 ? (
                <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">No Image</div>
              )}
              
              <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm border border-white/20">
                <span className="text-[12px] font-bold text-emerald-700">${item.price}</span>
              </div>
              <div className="absolute top-3 right-3 flex flex-col gap-2">
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
                <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center pointer-events-none">
                  <span className="px-3 py-1.5 bg-white/20 backdrop-blur-md border border-white/30 text-white text-[11px] font-bold tracking-widest uppercase rounded">Unavailable</span>
                </div>
              )}
            </div>
            
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 flex items-center justify-center border ${item.isVeg ? 'border-green-600' : 'border-red-600'} bg-white rounded-sm`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`}></div>
                  </div>
                  <p className="text-[10px] font-bold text-amber-600 tracking-widest uppercase">{item.category}</p>
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
              <p className="text-[12px] text-slate-500 leading-relaxed mb-4">{item.description}</p>
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
            className="bg-white rounded-2xl w-full max-w-[500px] max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '500px' }}
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Price ($)</label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                    <select 
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
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
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Upload Images (Max 2, 2MB each)</label>
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-slate-900" 
                  />
                  {imageFiles.length > 0 && (
                    <p className="text-xs text-emerald-600 mt-1">{imageFiles.length} file(s) selected</p>
                  )}
                </div>

                <div className="flex items-center gap-6 mt-4">
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
                      id="isVeg" 
                      checked={formData.isVeg}
                      onChange={(e) => setFormData(prev => ({ ...prev, isVeg: e.target.checked }))}
                      className="w-4 h-4 text-green-600 rounded border-slate-300 focus:ring-green-500"
                    />
                    <label htmlFor="isVeg" className="text-sm text-slate-700 cursor-pointer flex items-center gap-1">
                      <div className="w-3 h-3 flex items-center justify-center border border-green-600 bg-white rounded-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-600"></div>
                      </div>
                      Vegetarian
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
