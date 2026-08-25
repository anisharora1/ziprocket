"use client";

import React, { useState, useRef, useCallback } from "react";
import OptimizedImage from "./OptimizedImage";

export interface CarouselItem {
  name: string;
  price: number;
  images?: any[];
}

interface RestaurantCardCarouselProps {
  items: CarouselItem[];
  fallbackImage: string;
  restaurantName: string;
}

function getItemImageUrl(item: CarouselItem, fallback: string): string {
  if (item.images && Array.isArray(item.images) && item.images.length > 0) {
    const first = item.images[0];
    if (typeof first === "string" && first.trim()) return first.trim();
    if (typeof first === "object" && first?.url && typeof first.url === "string" && first.url.trim()) {
      return first.url.trim();
    }
  }
  return fallback;
}

export default function RestaurantCardCarousel({
  items = [],
  fallbackImage,
  restaurantName,
}: RestaurantCardCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);

  // If there are no menu items, gracefully fall back to a single image
  if (!items || items.length === 0) {
    return (
      <div className="w-full h-full relative overflow-hidden bg-slate-50">
        <OptimizedImage
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
          src={fallbackImage}
          alt={restaurantName}
          preset="card"
        />
      </div>
    );
  }

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    if (clientWidth > 0) {
      const newIndex = Math.round(scrollLeft / clientWidth);
      if (newIndex !== activeIndex && newIndex >= 0 && newIndex < items.length) {
        setActiveIndex(newIndex);
      }
    }
  }, [activeIndex, items.length]);

  const scrollToSlide = (idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (scrollRef.current) {
      const width = scrollRef.current.clientWidth;
      scrollRef.current.scrollTo({
        left: idx * width,
        behavior: "smooth",
      });
      setActiveIndex(idx);
    }
  };

  // Mouse drag handlers for desktop click-drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeftRef.current = scrollRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !scrollRef.current) return;
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startXRef.current);
    if (Math.abs(walk) > 5) {
      hasMovedRef.current = true;
    }
    scrollRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (hasMovedRef.current) {
      // Prevent link navigation if user dragged
      e.preventDefault();
    }
    isDraggingRef.current = false;
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className="relative w-full h-full group/carousel overflow-hidden">
      {/* Horizontally swipeable image container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className="w-full h-full overflow-x-auto snap-x snap-mandatory flex no-scrollbar scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden select-none"
      >
        {items.map((item, idx) => (
          <div
            key={idx}
            className="snap-center shrink-0 w-full h-full relative overflow-hidden bg-slate-50"
          >
            <OptimizedImage
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
              src={getItemImageUrl(item, fallbackImage)}
              alt={`${restaurantName} - ${item.name}`}
              preset="card"
            />

            {/* Top-left item name + price overlay badge */}
            <div className="absolute top-10 left-3 max-w-[65%] bg-black/65 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 shadow-sm z-10 pointer-events-none">
              <p className="text-[11px] font-bold text-white truncate leading-tight">
                {item.name}
              </p>
              <p className="text-[10px] font-extrabold text-amber-300 leading-tight mt-0.5">
                ₹{item.price}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom-center dot indicators */}
      {items.length > 1 && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 py-0.5 px-2 rounded-full bg-black/35 backdrop-blur-xs pointer-events-auto">
          {items.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => scrollToSlide(idx, e)}
              className={`transition-all duration-300 rounded-full ${
                idx === activeIndex
                  ? "w-3.5 h-1.5 bg-white shadow-sm"
                  : "w-1.5 h-1.5 bg-white/50 hover:bg-white/80"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
