"use client";

import React from "react";

export const HomeCategoriesSkeleton = () => (
  <section className="space-y-4 animate-in fade-in duration-300">
    <div className="flex justify-between items-center">
      <div className="h-6 w-56 bg-slate-100 rounded-lg animate-pulse" />
      <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
    </div>
    <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-3 sm:gap-4">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div
          key={i}
          className="bg-white border border-slate-100 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center text-center gap-2 animate-pulse h-[110px]"
        >
          <div className="w-12 h-12 rounded-full bg-slate-100" />
          <div className="h-3 w-16 bg-slate-100 rounded" />
        </div>
      ))}
    </div>
  </section>
);

export const GroceryListSkeleton = () => (
  <section className="space-y-md animate-in fade-in duration-300">
    <div className="flex justify-between items-center">
      <div className="h-6 w-48 bg-slate-100 rounded-lg animate-pulse" />
      <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
    </div>
    <div className="overflow-x-auto no-scrollbar flex gap-md -mx-md px-md pb-2">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="block min-w-[160px] md:min-w-[220px] max-w-[160px] md:max-w-[220px] bg-white rounded-2xl overflow-hidden border border-slate-100/70 shadow-sm shrink-0 animate-pulse h-[250px] sm:h-[280px] md:h-[310px]"
        >
          <div className="h-28 sm:h-32 md:h-36 bg-slate-100 w-full" />
          <div className="p-3 space-y-2">
            <div className="h-3 w-1/3 bg-slate-100 rounded" />
            <div className="h-4 w-3/4 bg-slate-100 rounded" />
            <div className="h-3 w-1/2 bg-slate-100 rounded" />
            <div className="h-4 w-1/4 bg-slate-100 rounded mt-3" />
          </div>
        </div>
      ))}
    </div>
  </section>
);
