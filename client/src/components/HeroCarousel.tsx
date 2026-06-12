"use client";

import React, { useEffect, useState, useRef } from "react";
import { apiClient } from "@/services/api";
import Link from "next/link";
import OptimizedImage from "./OptimizedImage";

interface Promotion {
  _id: string;
  title: string;
  description: string;
  image: string;
  targetType: "restaurant" | "grocery";
  category?: string;
  isActive: boolean;
}

export default function HeroCarousel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [banners, setBanners] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get("/promotions");
        if (res.data.success) {
          // Fetch ALL active banners published from admin dashboard (both grocery & restaurant targeting)
          const activeBanners = (res.data.promotions || []).filter(
            (p: Promotion) => p.isActive
          );
          setBanners(activeBanners);
        }
      } catch (err) {
        console.error("Failed to fetch homepage banners:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, []);

  // Use live database banners only
  const displayBanners = banners;

  // Auto-scrolling horizontal interval effect
  useEffect(() => {
    if (isPaused || displayBanners.length <= 1) return;

    const interval = setInterval(() => {
      if (!containerRef.current) return;
      const container = containerRef.current;
      
      const cardWidth = container.clientWidth;
      const maxScroll = container.scrollWidth - container.clientWidth;
      
      let nextScroll = container.scrollLeft + cardWidth;
      if (nextScroll > maxScroll + 10) {
        nextScroll = 0;
      }
      
      container.scrollTo({
        left: nextScroll,
        behavior: "smooth"
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [isPaused, displayBanners]);

  const handleScroll = () => {
    if (!containerRef.current || displayBanners.length === 0) return;
    const container = containerRef.current;
    const cardWidth = container.clientWidth;
    if (cardWidth > 0) {
      const idx = Math.round(container.scrollLeft / cardWidth);
      setActiveIdx(idx % displayBanners.length);
    }
  };

  if (loading) {
    return (
      <section className="overflow-x-auto no-scrollbar flex gap-md -mx-md px-md">
        <div className="min-w-full h-40 md:h-56 rounded-2xl bg-slate-100 animate-pulse shrink-0" />
      </section>
    );
  }

  if (displayBanners.length === 0) {
    return null;
  }

  return (
    <section className="relative group/carousel space-y-3">
      {/* Horizontally scrolling snapped carousel wrapper */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory gap-4 pb-1 scroll-smooth w-full"
      >
        {displayBanners.map((banner, idx) => {
          const destination = banner.category || (banner.targetType === "grocery" ? "/grocery" : "/restaurants");
          
          return (
            <Link 
              href={destination}
              key={banner._id} 
              className="w-full shrink-0 snap-center px-1"
            >
              <div className="h-40 md:h-56 rounded-2xl relative overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
                <OptimizedImage 
                  className="absolute inset-0 w-full h-full object-cover" 
                  src={banner.image}
                  alt={banner.title}
                  preset="large"
                  priority={idx === 0}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent flex flex-col justify-center p-md md:p-lg">
                  <span className="bg-[#FF5C00] text-white text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded w-fit mb-2">
                    {banner.targetType === "grocery" ? "Quick Store" : "Mega Deal"}
                  </span>
                  <h3 className="text-white font-h1 text-h1 md:text-2xl leading-tight max-w-[240px] md:max-w-[420px]">
                    {banner.title}
                  </h3>
                  <p className="text-white/80 text-label-sm font-bold mt-1">
                    {banner.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Carousel dots indicators */}
      {displayBanners.length > 1 && (
        <div className="flex justify-center items-center gap-1.5 mt-2">
          {displayBanners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (!containerRef.current) return;
                containerRef.current.scrollTo({
                  left: idx * containerRef.current.clientWidth,
                  behavior: "smooth"
                });
              }}
              className={`h-1.5 rounded-full transition-all duration-300 ${activeIdx === idx ? 'w-4 bg-[#FF5C00]' : 'w-1.5 bg-slate-200'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
