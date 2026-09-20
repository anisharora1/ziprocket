"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProductCard from "./ProductCard";
import { useCart } from "@/context/CartContext";
import { apiClient } from "@/services/api";

export default function PopularGroceries({ initialItems = [] }: { initialItems?: any[] }) {
  const router = useRouter();
  const { addToCart, cart, updateQuantity } = useCart();
  const [items, setItems] = useState<any[]>(initialItems);
  const [loading, setLoading] = useState<boolean>(initialItems.length === 0);

  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      setItems(initialItems);
      setLoading(false);
      return;
    }

    // Client-side fallback fetch in case SSR returned empty array or was cached
    let isMounted = true;
    const fetchGroceries = async () => {
      try {
        const res = await apiClient.get("/search/popular-groceries");
        const list = res.data?.items || res.data?.data?.items || [];
        if (isMounted && Array.isArray(list) && list.length > 0) {
          setItems(list);
        }
      } catch (err) {
        console.error("Failed to fetch popular groceries fallback:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchGroceries();

    return () => {
      isMounted = false;
    };
  }, [initialItems]);

  if (!loading && items.length === 0) {
    return null;
  }

  const getCartQuantity = (id: string) =>
    cart.items.find((i: any) => i.id === `groc-${id}` || i.id === id)?.quantity || 0;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-black text-slate-900">Popular Groceries</h2>
      </div>

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {[...Array(10)].map((_, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl h-48 sm:h-56 animate-pulse border border-slate-100 shadow-sm"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {items.map((prod) => (
            <ProductCard
              key={prod._id}
              prod={prod}
              qty={getCartQuantity(prod._id)}
              addToCart={addToCart}
              updateQuantity={updateQuantity}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => router.push("/grocery")}
        className="w-full py-3 mt-4 border-2 border-[#FF5C00] text-[#FF5C00] font-black text-sm rounded-2xl active:scale-[0.98] hover:bg-[#FF5C00]/5 transition-colors cursor-pointer"
      >
        Load More Groceries
      </button>
    </section>
  );
}
