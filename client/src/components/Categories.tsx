"use client";

import React from "react";
import Link from "next/link";
import { useLocation } from "@/context/LocationContext";

export default function Categories() {
  const { isLocationLoaded } = useLocation();

  if (!isLocationLoaded) {
    return (
      <section className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-md">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="bg-white p-md rounded-2xl flex flex-col items-center justify-center border border-slate-100 shadow-sm animate-pulse h-[142px]"
          >
            <div className="w-16 h-16 rounded-full bg-slate-100 mb-2 animate-pulse" />
            <div className="h-4 w-12 bg-slate-100 rounded mb-1 animate-pulse" />
            <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-md animate-in fade-in duration-300">
      <Link
        href="/restaurants"
        prefetch={false}
        className="bg-white p-md rounded-2xl flex flex-col items-center justify-center shadow-sm border border-slate-100 transition-all active:scale-95 cursor-pointer"
      >
        <div className="w-16 h-16 bg-[#FFF1E6] rounded-full flex items-center justify-center mb-2">
          <span className="text-3xl">🍔</span>
        </div>
        <span className="font-h2 text-h2 text-slate-800">Food</span>
        <span className="text-slate-500 text-label-sm">Hungry?</span>
      </Link>
      <Link
        href="/grocery"
        prefetch={false}
        className="bg-white p-md rounded-2xl flex flex-col items-center justify-center shadow-sm border border-slate-100 transition-all active:scale-95 cursor-pointer"
      >
        <div className="w-16 h-16 bg-[#E6F4EA] rounded-full flex items-center justify-center mb-2">
          <span className="text-3xl">🛒</span>
        </div>
        <span className="font-h2 text-h2 text-slate-800">Grocery</span>
        <span className="text-slate-500 text-label-sm">Fresh Daily</span>
      </Link>
    </section>
  );
}
