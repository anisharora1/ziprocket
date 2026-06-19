"use client";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Load the interactive carousel only after hydration - no SSR to avoid hydration mismatch
const HeroCarousel = dynamic(() => import("./HeroCarousel"), {
  ssr: false,
  loading: () => null, // Return null while loading - the SSR placeholder underneath shows
});

/**
 * HeroCarouselClient: renders on top of the SSR placeholder after hydration.
 * This component is invisible until mounted, then it overlays and replaces
 * the static SSR placeholder with the interactive carousel.
 * 
 * The SSR placeholder (rendered by page.tsx server component) provides the LCP image
 * in the initial HTML payload. This component takes over after React hydrates.
 */
export default function HeroCarouselClient() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Small delay so the SSR placeholder is visible during LCP measurement
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  if (!mounted) return null;

  return (
    <div className="absolute inset-0 z-10">
      <HeroCarousel />
    </div>
  );
}
