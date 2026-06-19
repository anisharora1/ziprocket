"use client";
import React from "react";
import dynamic from "next/dynamic";

// Lightweight skeleton that renders instantly while SearchBar JS chunk loads
const SearchBarSkeleton = () => (
  <div className="pt-md pb-xs">
    <div className="relative">
      <div className="block w-full h-14 bg-white border border-slate-200 rounded-xl shadow-sm animate-pulse" />
    </div>
  </div>
);

const SearchBar = dynamic(() => import("./SearchBar"), {
  ssr: false,
  loading: () => <SearchBarSkeleton />,
});

export default SearchBar;
