"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/services/api";
import Link from "next/link";

interface Restaurant {
  _id: string;
  name: string;
  phone: string;
  cuisines: string;
  image?: string;
  rating: number;
  isActive: boolean;
}

interface Promotion {
  _id: string;
  restaurant?: Restaurant;
  targetType: "restaurant" | "grocery";
  category?: string;
  image: string;
  title: string;
  description: string;
  isActive: boolean;
}

export default function TopRated() {
  const [featuredItems, setFeaturedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeaturedAndTop = async () => {
      try {
        setLoading(true);
        // 1. Fetch live restaurant promotions/featured ads from admin desk
        const promoRes = await apiClient.get("/admin/promotions");
        let activeRestaurantAds: any[] = [];
        if (promoRes.data.success) {
          activeRestaurantAds = (promoRes.data.promotions || []).filter(
            (p: Promotion) => p.isActive && p.targetType === "restaurant" && p.restaurant
          );
        }

        // 2. Fetch all approved restaurants to find top-rated ones for fallback/mix
        const restRes = await apiClient.get("/restaurants?status=approved&isActive=true");
        let topRatedRestaurants: any[] = [];
        if (restRes.data.success) {
          const allRest = restRes.data.restaurants || [];
          topRatedRestaurants = [...allRest].sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
        }

        // 3. Assemble featured section: Prioritize published admin ads, then pad with top-rated fallback restaurants
        const assembled: any[] = [];
        
        // Add all active sponsored restaurant ads first
        activeRestaurantAds.forEach((ad: Promotion) => {
          if (ad.restaurant) {
            assembled.push({
              _id: ad.restaurant._id,
              name: ad.restaurant.name,
              cuisines: ad.restaurant.cuisines,
              rating: ad.restaurant.rating || 4.5,
              image: ad.image || ad.restaurant.image,
              isAd: true,
              badgeText: ad.description.split("•")[0].trim() || "Featured"
            });
          }
        });

        // Add top-rated restaurants that aren't already included as ads, up to 6 total items
        topRatedRestaurants.forEach((rest: Restaurant) => {
          if (!assembled.some(item => item._id === rest._id) && assembled.length < 6) {
            assembled.push({
              _id: rest._id,
              name: rest.name,
              cuisines: rest.cuisines,
              rating: rest.rating || 4.0,
              image: rest.image,
              isAd: false,
              badgeText: ""
            });
          }
        });

        setFeaturedItems(assembled);
      } catch (err) {
        console.error("Failed to fetch featured/top rated restaurants:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedAndTop();
  }, []);

  if (loading) {
    // High fidelity loading skeletons
    return (
      <section className="space-y-md">
        <div className="flex justify-between items-center">
          <div className="h-6 w-48 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-4 w-12 bg-slate-100 rounded-lg animate-pulse" />
        </div>
        <div className="overflow-x-auto no-scrollbar flex gap-md -mx-md px-md pb-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="min-w-[160px] md:min-w-[220px] max-w-[160px] md:max-w-[220px] h-40 bg-slate-100 rounded-xl animate-pulse shrink-0" />
          ))}
        </div>
      </section>
    );
  }

  if (featuredItems.length === 0) {
    return null;
  }

  return (
    <section className="space-y-md">
      <div className="flex justify-between items-center">
        <h2 className="font-h1 text-h1 text-slate-800">Featured & Top Rated</h2>
        <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-widest">
          Sponsor Choices
        </span>
      </div>
      
      <div className="overflow-x-auto no-scrollbar flex gap-md -mx-md px-md pb-2">
        {featuredItems.map((restaurant) => (
          <Link 
            href={`/restaurants/${restaurant._id}`} 
            key={restaurant._id} 
            className="block min-w-[160px] md:min-w-[220px] max-w-[160px] md:max-w-[220px] bg-white rounded-2xl overflow-hidden border border-slate-100/70 shadow-sm relative shrink-0 transition-transform hover:-translate-y-0.5 active:scale-95 duration-200"
          >
            {/* Show AD / Featured badge if published from admin desk */}
            {restaurant.isAd && (
              <div className="absolute top-2 left-2 bg-primary-container text-white text-[8px] font-black tracking-wider uppercase px-2 py-0.5 rounded-lg z-10 shadow-sm">
                {restaurant.badgeText || "SPONSORED"}
              </div>
            )}
            
            <img 
              className="h-28 w-full object-cover" 
              src={restaurant.image || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=300"}
              alt={restaurant.name}
            />
            
            <div className="p-3 space-y-1">
              <p className="font-bold text-[14px] text-slate-800 truncate leading-snug">
                {restaurant.name}
              </p>
              
              <div className="flex items-center justify-between text-slate-450 text-[11px] font-semibold mt-1">
                <div className="flex items-center gap-0.5 text-amber-500">
                  <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  <span>{restaurant.rating > 0 ? restaurant.rating.toFixed(1) : "New"}</span>
                </div>
                <span className="text-[10px] text-slate-450 truncate max-w-[90px]">
                  {restaurant.cuisines ? restaurant.cuisines.split(",")[0] : "Fast Food"}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
