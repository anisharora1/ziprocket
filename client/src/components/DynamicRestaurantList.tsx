"use client";
import React from "react";
import dynamic from "next/dynamic";

const RestaurantListSkeleton = () => (
  <section className="space-y-md">
    <div className="flex justify-between items-end">
      <div className="h-6 w-56 bg-slate-100 rounded-lg animate-pulse" />
      <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-[300px] animate-pulse" style={{ height: "300px" }}>
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

const RestaurantList = dynamic(() => import("./RestaurantList"), {
  ssr: false,
  loading: () => <RestaurantListSkeleton />
});

export default RestaurantList;
