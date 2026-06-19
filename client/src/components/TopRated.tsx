"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import OptimizedImage from "./OptimizedImage";
import { apiClient } from "@/services/api";

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

const TopRatedSkeleton = () => (
  <section className="space-y-md">
    <div className="flex justify-between items-center">
      <div className="h-6 w-48 bg-slate-100 rounded-lg animate-pulse" />
      <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
    </div>
    <div className="overflow-x-auto no-scrollbar flex gap-md -mx-md px-md pb-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="block min-w-[160px] md:min-w-[220px] max-w-[160px] md:max-w-[220px] bg-white rounded-2xl overflow-hidden border border-slate-100/70 shadow-sm relative shrink-0 animate-pulse">
          <div className="h-28 bg-slate-100 w-full" />
          <div className="p-3 space-y-2">
            <div className="h-4 w-3/4 bg-slate-100 rounded" />
            <div className="flex justify-between items-center mt-2">
              <div className="h-3 w-1/4 bg-slate-100 rounded" />
              <div className="h-3 w-1/3 bg-slate-100 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
);

// In-memory cache to persist featured items across page navigations
let cachedFeaturedItems: any[] | null = null;
let cachedFeaturedFetched = false;

export default function TopRated() {
  const [featuredItems, setFeaturedItems] = useState<any[]>(cachedFeaturedItems || []);
  const [loading, setLoading] = useState(!cachedFeaturedFetched);

  useEffect(() => {
    const fetchFeatured = async (isBackground = false) => {
      try {
        if (!isBackground) {
          setLoading(true);
        }
        const [promoRes, restRes] = await Promise.all([
          apiClient.get("/promotions"),
          apiClient.get("/restaurants?status=approved&isActive=true")
        ]);

        let activeRestaurantAds: any[] = [];
        if (promoRes.data.success) {
          activeRestaurantAds = (promoRes.data.promotions || []).filter(
            (p: Promotion) => p.isActive && p.targetType === "restaurant" && p.restaurant
          );
        }

        let topRatedRestaurants: any[] = [];
        if (restRes.data.success) {
          const allRest = restRes.data.restaurants || [];
          topRatedRestaurants = [...allRest].sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
        }

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

        if (assembled.length > 0) {
          setFeaturedItems(assembled);
          cachedFeaturedItems = assembled;
          cachedFeaturedFetched = true;
        }
      } catch (err) {
        console.error("Failed to fetch featured/top rated restaurants on client:", err);
      } finally {
        setLoading(false);
      }
    };

    if (cachedFeaturedFetched) {
      // Revalidate in background immediately on revisit
      fetchFeatured(true);
      return;
    }

    // Defer data fetch until after first paint to prioritize LCP rendering on first load
    const timer = setTimeout(() => fetchFeatured(false), 1000);
    return () => clearTimeout(timer);
  }, []);


  if (loading) {
    return <TopRatedSkeleton />;
  }

  if (featuredItems.length === 0) {
    return null;
  }

  return (
    <section className="space-y-md">
      <div className="flex justify-between items-center">
        <h2 className="font-h1 text-lg sm:text-xl md:text-h1 text-slate-800">Featured & Top Rated</h2>
        <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-widest">
          Sponsor Choices
        </span>
      </div>
      
      <div className="overflow-x-auto no-scrollbar flex gap-md -mx-md px-md pb-2">
        {featuredItems.map((restaurant) => (
          <Link 
            href={`/restaurants/${restaurant._id}`} 
            prefetch={false}
            key={restaurant._id} 
            className="block min-w-[160px] md:min-w-[220px] max-w-[160px] md:max-w-[220px] bg-white rounded-2xl overflow-hidden border border-slate-100/70 shadow-sm relative shrink-0 transition-transform hover:-translate-y-0.5 active:scale-95 duration-200"
          >
            {restaurant.isAd && (
              <div className="absolute top-2 left-2 bg-[#FF5C00] text-white text-[8px] font-black tracking-wider uppercase px-2 py-0.5 rounded-lg z-10 shadow-sm">
                {restaurant.badgeText || "SPONSORED"}
              </div>
            )}
            
            <OptimizedImage 
              className="h-28 w-full object-cover" 
              src={restaurant.image || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=300"}
              alt={restaurant.name}
              preset="card"
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
                <span className="text-[10px] text-slate-455 truncate max-w-[90px]">
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
