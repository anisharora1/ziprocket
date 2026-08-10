"use client";

import { useState, useEffect } from "react";
import { apiClient } from "../../services/api";
import OptimizedImage from "../OptimizedImage";
import { MdMenu } from "react-icons/md";

export default function SellerMobileHeader() {
  const [restaurant, setRestaurant] = useState<any>(null);

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const res = await apiClient.get('/restaurants/my-restaurant');
        if (res.data.success) {
          setRestaurant(res.data.restaurant);
        }
      } catch (err) {
        console.error("Failed to fetch restaurant profile", err);
      }
    };
    fetchRestaurant();
  }, []);

  return (
    <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 shrink-0 shadow-sm z-30 sticky top-0">
      <div className="flex items-center gap-2 text-emerald-700 font-black tracking-tight text-[18px]">
        <MdMenu className="text-[20px]" />
        Kitchen OS
      </div>
      
      {restaurant ? (
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-slate-800 hidden sm:block truncate max-w-[120px]">
            {restaurant.name}
          </span>
          <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-200 shadow-sm">
            {restaurant.image ? (
              <OptimizedImage src={restaurant.image} alt={restaurant.name} preset="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[14px]">
                {restaurant.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse border border-slate-200"></div>
      )}
    </div>
  );
}
