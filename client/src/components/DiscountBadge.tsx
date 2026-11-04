import React from "react";
import { getDiscountPercent } from "@/utils/discount";

export interface DiscountBadgeProps {
  price?: number | null;
  discountedPrice?: number | null;
  className?: string;
}

export default function DiscountBadge({
  price,
  discountedPrice,
  className = "",
}: DiscountBadgeProps) {
  const percent = getDiscountPercent(price, discountedPrice);

  if (percent <= 0) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-50 text-[#FF5C00] border border-orange-200/80 shrink-0 whitespace-nowrap shadow-2xs leading-none ${className}`}
    >
      {percent}% OFF
    </span>
  );
}

