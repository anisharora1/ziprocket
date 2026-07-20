"use client";

import React from "react";
import OptimizedImage from "./OptimizedImage";
import { useCart } from "@/context/CartContext";
import { usePlatform } from "@/context/PlatformContext";

export interface Product {
  _id: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  price: number;
  discountedPrice?: number;
  stockQuantity: number;
  unit: string;
  images: string[];
  weightSize: string;
  isAvailable: boolean;
  offerBadge?: string;
}

interface ProductCardProps {
  prod: Product;
  qty: number;
  addToCart: any;
  updateQuantity: any;
}

export default function ProductCard({
  prod,
  qty,
  addToCart,
  updateQuantity,
}: ProductCardProps) {
  const currentPrice = prod.discountedPrice || prod.price;
  const { isGroceryCurrentlyOpen } = usePlatform();
  const isGroceryOpen = isGroceryCurrentlyOpen();

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(255,92,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col relative group cursor-pointer">
      {/* Badge offer */}
      {prod.offerBadge && (
        <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-red-500 text-white font-extrabold text-[9px] rounded-md shadow-sm">
          {prod.offerBadge}
        </span>
      )}

      {/* Image box */}
      <div className="p-3 bg-white relative flex justify-center items-center h-28 sm:h-32 md:h-36 border-b border-slate-50 shrink-0">
        {prod.images && prod.images[0] ? (
          <OptimizedImage
            src={prod.images[0]}
            alt={prod.name}
            preset="thumbnail"
            className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <span className="material-symbols-outlined text-slate-300 text-[32px]">image</span>
        )}

        {/* Add/Cart controls bottom overlay */}
        <div className="absolute -bottom-3 right-3 shrink-0">
          {qty > 0 ? (
            <div className="flex items-center bg-white border border-[#FF5C00] rounded-xl shadow-md overflow-hidden font-black text-xs">
              <button
                disabled={!isGroceryOpen || !prod.isAvailable}
                onClick={(e) => {
                  e.stopPropagation();
                  updateQuantity(`groc-${prod._id}`, qty - 1);
                }}
                className={`px-2 py-1.5 hover:bg-slate-50 text-[#FF5C00] ${
                  !isGroceryOpen || !prod.isAvailable ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                -
              </button>
              <span className="px-2.5 text-slate-800">{qty}</span>
              <button
                disabled={!isGroceryOpen || !prod.isAvailable}
                onClick={(e) => {
                  e.stopPropagation();
                  if (qty >= prod.stockQuantity) {
                    alert(`Sorry! Only ${prod.stockQuantity} units available.`);
                    return;
                  }
                  updateQuantity(`groc-${prod._id}`, qty + 1);
                }}
                className={`px-2 py-1.5 hover:bg-slate-50 text-[#FF5C00] ${
                  !isGroceryOpen || !prod.isAvailable ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                +
              </button>
            </div>
          ) : (
            <button
              disabled={!prod.isAvailable || prod.stockQuantity === 0 || !isGroceryOpen}
              onClick={(e) => {
                e.stopPropagation();
                addToCart({
                  item: {
                    id: `groc-${prod._id}`,
                    name: prod.name,
                    price: currentPrice,
                    quantity: 1,
                    img: prod.images[0],
                  },
                  vendorId: "zip-grocery-hub",
                  vendorName: "ZipGrocery Stores",
                  orderType: "grocery",
                });
              }}
              className={`bg-white border font-black text-[11px] px-3.5 py-1.5 rounded-xl shadow-md uppercase tracking-wider transition-all duration-200 active:scale-95 ${
                !prod.isAvailable || prod.stockQuantity === 0 || !isGroceryOpen
                  ? "border-slate-300 text-slate-400 bg-slate-50 cursor-default shadow-none"
                  : "border-[#FF5C00] text-[#FF5C00] hover:bg-[#FF5C00]/5"
              }`}
            >
              {!prod.isAvailable
                ? "Unavailable"
                : prod.stockQuantity === 0
                ? "Out of Stock"
                : "Add"}
            </button>
          )}
        </div>
      </div>

      {/* Details Box */}
      <div className="p-3 pt-5 flex-1 flex flex-col bg-white">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">
          {prod.brand || "Local Brand"}
        </span>
        <h4 className="text-[12px] font-bold text-slate-800 leading-snug line-clamp-2 mb-1 group-hover:text-[#FF5C00] transition-colors">
          {prod.name}
        </h4>
        <span className="text-[10px] text-slate-400 font-bold mb-3">
          {prod.weightSize}
        </span>

        <div className="mt-auto flex items-baseline gap-1.5">
          <span className="text-sm font-black text-slate-900">₹{currentPrice}</span>
          {prod.discountedPrice && (
            <span className="text-xs font-semibold text-slate-400 line-through">
              ₹{prod.price}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
