/**
 * Calculates discount percentage.
 * Returns floor((price - discountedPrice) / price * 100),
 * or 0 unless discountedPrice > 0, discountedPrice < price, and the result >= 1.
 */
export function getDiscountPercent(
  price?: number | null,
  discountedPrice?: number | null
): number {
  if (
    price === undefined ||
    price === null ||
    discountedPrice === undefined ||
    discountedPrice === null
  ) {
    return 0;
  }

  const p = Number(price);
  const dp = Number(discountedPrice);

  if (isNaN(p) || isNaN(dp) || p <= 0 || dp <= 0 || dp >= p) {
    return 0;
  }

  const pct = Math.floor(((p - dp) / p) * 100);
  return pct >= 1 ? pct : 0;
}

export { default as DiscountBadge } from '../components/DiscountBadge';
export type { DiscountBadgeProps } from '../components/DiscountBadge';

