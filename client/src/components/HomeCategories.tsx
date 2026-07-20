"use client";

import React from "react";
import Link from "next/link";

interface CategoryItem {
  name: string;
  icon: string;
  color: string; // Tailwind background/text classes for a premium themed feel
  href: string;
}

const HOME_CATEGORIES: CategoryItem[] = [
  {
    name: "Fruits & Veggies",
    icon: "🥦",
    color: "bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]/50",
    href: "/grocery/category/Vegetables%20%26%20Fruits",
  },
  {
    name: "Dairy & Bread",
    icon: "🥛",
    color: "bg-[#FDF4E5] text-[#B06000] border-[#FADFBC]/50",
    href: "/grocery/category/Dairy%20%26%20Bread",
  },
  {
    name: "Munchies",
    icon: "🍿",
    color: "bg-[#FFF1E6] text-[#FF5C00] border-[#FFE2CC]/50",
    href: "/grocery/category/Munchies",
  },
  {
    name: "Drinks & Juices",
    icon: "🥤",
    color: "bg-[#E8F0FE] text-[#1A73E8] border-[#D2E3FC]/50",
    href: "/grocery/category/Cold%20Drinks%20%26%20Juices",
  },
  {
    name: "Atta & Flours",
    icon: "🌾",
    color: "bg-[#FFEBE5] text-[#C23900] border-[#FFD5CC]/50",
    href: "/grocery/category/Atta%2C%20Rice%20%26%20Dals",
  },
  {
    name: "Biryani",
    icon: "🥘",
    color: "bg-[#FFF2E6] text-[#B85C00] border-[#FFE2CC]/50",
    href: "/restaurants?q=Biryani",
  },
  {
    name: "Pizza & Pasta",
    icon: "🍕",
    color: "bg-[#FCE8E6] text-[#C5221F] border-[#FAD2CF]/50",
    href: "/restaurants?q=Pizza",
  },
  {
    name: "Burgers",
    icon: "🍔",
    color: "bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]/50",
    href: "/restaurants?q=Burger",
  },
];

export default function HomeCategories() {
  return (
    <section className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-h1 text-lg sm:text-xl md:text-h1 text-slate-800">
          What would you like to order?
        </h2>
        <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-widest">
          Food & Groceries
        </span>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-3 sm:gap-4">
        {HOME_CATEGORIES.map((cat) => (
          <Link
            key={cat.name}
            href={cat.href}
            prefetch={false}
            className="bg-white border border-slate-100 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center text-center gap-2 hover:shadow-[0_4px_20px_rgba(255,92,0,0.06)] hover:border-[#FF5C00]/20 transition-all duration-300 group cursor-pointer active:scale-95"
          >
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 border ${cat.color} overflow-hidden shadow-sm`}
            >
              <span className="text-2xl transition-transform duration-300 group-hover:rotate-3">
                {cat.icon}
              </span>
            </div>
            <span className="text-[11px] font-bold text-slate-800 line-clamp-1 leading-snug">
              {cat.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
