"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { apiClient } from "@/services/api";
import { useCart } from "@/context/CartContext";
import ProductCard, { Product } from "./ProductCard";
import { GroceryListSkeleton } from "./Skeletons";

export default function GroceryList() {
  const { addToCart, cart, updateQuantity } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroceryProducts = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get("/grocery?isFeatured=true&limit=8");
        if (res.data.success) {
          setProducts(res.data.products || []);
        }
      } catch (err) {
        console.error("Failed to fetch featured groceries for home page:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGroceryProducts();
  }, []);

  const getCartQuantity = (productId: string) => {
    const item = cart.items.find((i) => i.id === `groc-${productId}`);
    return item ? item.quantity : 0;
  };

  if (loading) {
    return <GroceryListSkeleton />;
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section className="space-y-md">
      <div className="flex justify-between items-center">
        <h2 className="font-h1 text-lg sm:text-xl md:text-h1 text-slate-800">
          Deals & Featured Groceries
        </h2>
        <Link
          href="/grocery"
          prefetch={false}
          className="text-[#FF5C00] font-bold text-xs hover:text-[#e05200] flex items-center gap-0.5 transition-colors"
        >
          See all
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        </Link>
      </div>

      <div className="overflow-x-auto no-scrollbar flex gap-md -mx-md px-md pb-2">
        {products.map((prod) => (
          <div
            key={prod._id}
            className="block min-w-[160px] md:min-w-[220px] max-w-[160px] md:max-w-[220px] shrink-0"
          >
            <ProductCard
              prod={prod}
              qty={getCartQuantity(prod._id)}
              addToCart={addToCart}
              updateQuantity={updateQuantity}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
