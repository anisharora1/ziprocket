"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import OptimizedImage from "./OptimizedImage";
import { apiClient } from "@/services/api";
import { MdStar } from "react-icons/md";

interface Restaurant {
  _id: string;
  name: string;
  phone?: string;
  cuisines?: string;
  image?: string;
  rating?: number;
  totalOrders?: number;
  isActive?: boolean;
  popularItems?: any[];
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

interface TopRatedProps {
  initialRestaurants?: Restaurant[];
  initialPromotions?: any[];
}

function getFoodThumbnail(rest: Restaurant): string {
  if (Array.isArray(rest?.popularItems)) {
    for (const item of rest.popularItems) {
      if (Array.isArray(item?.images) && item.images.length > 0) {
        const firstImg = item.images[0];
        if (typeof firstImg === "string" && firstImg.trim()) {
          return firstImg.trim();
        }
        if (firstImg && typeof firstImg === "object" && typeof firstImg.url === "string" && firstImg.url.trim()) {
          return firstImg.url.trim();
        }
      }
    }
  }
  return rest?.image || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=300";
}

function assembleFeaturedItems(promotionsOrRestaurants: any[] = [], restaurants: Restaurant[] = []): Restaurant[] {
  const source = Array.isArray(restaurants) && restaurants.length > 0 ? restaurants : promotionsOrRestaurants;
  const list: Restaurant[] = Array.isArray(source) ? source : [];

  return list
    .filter((r) => Number(r?.rating) > 0 && r?.isActive !== false)
    .sort((a, b) => {
      const ratingDiff = (Number(b?.rating) || 0) - (Number(a?.rating) || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (Number(b?.totalOrders) || 0) - (Number(a?.totalOrders) || 0);
    })
    .slice(0, 3);
}

// In-memory cache to persist featured items across page navigations
let cachedFeaturedItems: Restaurant[] | null = null;
let cachedFeaturedFetched = false;

export default function TopRated({
  initialRestaurants = [],
  initialPromotions = []
}: TopRatedProps = {}) {
  const initialItems = assembleFeaturedItems(initialPromotions, initialRestaurants);
  const [featuredItems, setFeaturedItems] = useState<Restaurant[]>(() => {
    if (cachedFeaturedItems && cachedFeaturedItems.length > 0) {
      return cachedFeaturedItems;
    }
    return initialItems;
  });
  const [loading, setLoading] = useState(
    !cachedFeaturedFetched && initialItems.length === 0 && (!cachedFeaturedItems || cachedFeaturedItems.length === 0)
  );

  useEffect(() => {
    const fetchFeatured = async (isBackground = false) => {
      try {
        if (!isBackground && featuredItems.length === 0) {
          setLoading(true);
        }
        const restRes = await apiClient.get("/restaurants?status=approved&isActive=true&sort=rating&limit=10");
        const rawRests: Restaurant[] = restRes.data?.success ? (restRes.data.restaurants || []) : [];

        const assembled = assembleFeaturedItems(rawRests);

        setFeaturedItems(assembled);
        cachedFeaturedItems = assembled;
        cachedFeaturedFetched = true;
      } catch (err) {
        console.error("Failed to fetch top rated restaurants on client:", err);
      } finally {
        setLoading(false);
      }
    };

    if (cachedFeaturedFetched || initialItems.length > 0) {
      // Revalidate in background immediately on revisit or after initial SSR paint
      fetchFeatured(true);
      return;
    }

    fetchFeatured(false);
  }, []);

  if (loading) {
    return <TopRatedSkeleton />;
  }

  if (featuredItems.length === 0) {
    return null;
  }

  return (
    <section className="space-y-md animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="font-h1 text-lg sm:text-xl md:text-h1 text-slate-800">Top Rated</h2>
      </div>

      <div className="overflow-x-auto no-scrollbar flex gap-md -mx-md px-md pb-2">
        {featuredItems.map((restaurant) => (
          <Link
            href={`/restaurants/${restaurant._id}`}
            prefetch={false}
            key={restaurant._id}
            className="block min-w-[160px] md:min-w-[220px] max-w-[160px] md:max-w-[220px] bg-white rounded-2xl overflow-hidden border border-slate-100/70 shadow-sm relative shrink-0 transition-transform hover:-translate-y-0.5 active:scale-95 duration-200"
          >
            <OptimizedImage
              className="h-28 w-full object-cover"
              src={getFoodThumbnail(restaurant)}
              alt={restaurant.name}
              preset="card"
            />

            <div className="p-3 space-y-1">
              <p className="font-bold text-[14px] text-slate-800 truncate leading-snug">
                {restaurant.name}
              </p>

              <div className="flex items-center justify-between text-slate-450 text-[11px] font-semibold mt-1">
                {(Number(restaurant?.rating) || 0) > 0 ? (
                  <div className="flex items-center gap-0.5 text-amber-500">
                    <MdStar className="text-[13px]" />
                    <span>{Number(restaurant.rating).toFixed(1)}</span>
                  </div>
                ) : (
                  <div></div>
                )}
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
