"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/services/api";
import { useLocation } from "@/context/LocationContext";
import Link from "next/link";
import OptimizedImage from "./OptimizedImage";

interface Restaurant {
  _id: string;
  name: string;
  phone: string;
  cuisines: string;
  image?: string;
  rating: number;
  isActive: boolean;
  totalOrders: number;
  status: string;
  location?: {
    address: string;
    lat: number;
    lng: number;
  };
}

export default function RestaurantList() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoneName, setZoneName] = useState<string | null>(null);
  const [feasibilityError, setFeasibilityError] = useState<string | null>(null);
  const { location: userCoords, pincode: userPincode } = useLocation();

  useEffect(() => {
    const loadZoneAndRestaurants = async () => {
      try {
        setLoading(true);
        setFeasibilityError(null);
        let zoneId = "";
        let resolvedZoneName = "";

        if (userCoords?.lat && userCoords?.lng) {
          try {
            const feasibilityRes = await apiClient.post("/delivery-zones/check-feasibility", {
              userLat: userCoords.lat,
              userLng: userCoords.lng,
              pincode: userPincode || ""
            });
            if (feasibilityRes.data.success) {
              zoneId = feasibilityRes.data.zoneId;
              resolvedZoneName = feasibilityRes.data.zoneName;
              setZoneName(resolvedZoneName);
            }
          } catch (err: any) {
            console.error("User is outside operational bounds or feasibility fetch failed:", err);
            setFeasibilityError(err.response?.data?.message || "Outside delivery radius");
          }
        }

        // Fetch restaurants, filtered by zoneId if resolved, else fetch all approved
        const url = zoneId 
          ? `/restaurants?status=approved&isActive=true&deliveryZone=${zoneId}`
          : "/restaurants?status=approved&isActive=true";

        const res = await apiClient.get(url);
        if (res.data.success) {
          setRestaurants(res.data.restaurants || []);
        }
      } catch (err) {
        console.error("Failed to fetch restaurant listing:", err);
      } finally {
        setLoading(false);
      }
    };

    loadZoneAndRestaurants();
  }, [userCoords, userPincode]);

  if (loading) {
    // Premium loading skeletons
    return (
      <section className="space-y-md">
        <div className="flex justify-between items-end">
          <div className="h-6 w-56 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-[300px] animate-pulse">
              <div className="h-44 bg-slate-100" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-3/4 bg-slate-100 rounded" />
                <div className="h-3 w-1/2 bg-slate-100 rounded" />
                <div className="h-3 w-1/3 bg-slate-100 rounded pt-2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-md">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-h1 text-h1 text-slate-800">Restaurants Around You</h2>
          {zoneName && (
            <p className="text-[10px] text-[#FF5C00] font-black uppercase tracking-widest mt-1.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">location_on</span>
              Delivering in {zoneName}
            </p>
          )}
        </div>

        {feasibilityError && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl px-3.5 py-2 text-rose-700 text-xs font-semibold flex items-center gap-2 w-full sm:max-w-sm self-stretch sm:self-center">
            <span className="material-symbols-outlined text-[16px] text-rose-500 shrink-0">warning</span>
            <span>{feasibilityError}. Showing all restaurants.</span>
          </div>
        )}
      </div>
      
      {restaurants.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white rounded-3xl border border-slate-100/80 shadow-sm max-w-xl mx-auto my-6">
          <span className="material-symbols-outlined text-5xl text-slate-200 mb-3 block">storefront</span>
          <p className="text-slate-700 font-black text-[15px]">No active restaurants found in your zone.</p>
          <p className="text-slate-400 text-xs font-semibold mt-1">Please approve restaurant profiles in the admin panel to publish them here!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {restaurants.map((restaurant) => (
            <Link 
              href={`/restaurants/${restaurant._id}`} 
              key={restaurant._id} 
              className="block bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100/70 transition-all hover:shadow-md hover:-translate-y-0.5 duration-200 active:scale-[0.98] group"
            >
              <div className="h-44 relative overflow-hidden bg-slate-50">
                <OptimizedImage 
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103" 
                  src={restaurant.image || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=600"}
                  alt={restaurant.name}
                  preset="card"
                />
                
                {/* Simulated delivery time */}
                <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-xl shadow-sm border border-slate-100/40">
                  <span className="font-bold text-[10px] text-slate-800">
                    25-35 mins
                  </span>
                </div>
                
                {/* Activity Status */}
                {restaurant.isActive ? (
                  <div className="absolute top-3 left-3 bg-[#FF5C00] text-white px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm">
                    OPEN
                  </div>
                ) : (
                  <div className="absolute top-3 left-3 bg-rose-500 text-white px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm">
                    CLOSED
                  </div>
                )}
              </div>
              
              <div className="p-4 space-y-1">
                <div className="flex justify-between items-start gap-3">
                  <h3 className="font-bold text-[16px] text-slate-850 truncate leading-snug group-hover:text-[#FF5C00] transition-colors">
                    {restaurant.name}
                  </h3>
                  <div className="flex items-center gap-0.5 bg-[#FFF1E6] text-[#FF5C00] px-2 py-0.5 rounded-lg text-[10px] font-extrabold shrink-0 border border-[#FFE2CC]/40">
                    <span>{restaurant.rating > 0 ? restaurant.rating.toFixed(1) : "New"}</span>
                    <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  </div>
                </div>
                
                <p className="text-slate-400 text-xs font-semibold truncate">
                  {restaurant.location?.address || "Address not provided"}
                </p>
                
                <div className="pt-3 flex items-center justify-between border-t border-slate-50 mt-3 text-[11px] font-bold text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-slate-350 text-[16px]">store</span>
                    <span>
                      {restaurant.totalOrders || 0} orders completed
                    </span>
                  </div>
                  
                  {restaurant.status === "pending" && (
                    <span className="text-[9px] bg-amber-55 text-amber-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
