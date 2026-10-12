import { Restaurant } from '../types';

export interface OrderedRestaurantsResult {
  featured: Restaurant[];
  topRated: Restaurant[];
  pinned: Restaurant[];
  rest: Restaurant[];
  ordered: Restaurant[];
  featuredIds: string[];
}

/**
 * Standard Fisher-Yates (Knuth) in-place shuffle on a copied array.
 */
export function fisherYatesShuffle<T>(items: T[]): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

/**
 * Extracts unique restaurant IDs from active restaurant-type promotions,
 * preserving promotional priority order.
 */
export function extractFeaturedRestaurantIds(promotions: any[] = []): string[] {
  const ids: string[] = [];
  if (!Array.isArray(promotions)) return ids;

  for (const promo of promotions) {
    if (promo && promo.isActive && promo.targetType === 'restaurant' && promo.restaurant) {
      const restId =
        typeof promo.restaurant === 'object' ? promo.restaurant._id : promo.restaurant;
      if (restId && typeof restId === 'string' && !ids.includes(restId)) {
        ids.push(restId);
      }
    }
  }

  return ids;
}

/**
 * Orders restaurants for the mobile Home screen:
 * 1. Pinned group:
 *    a) Sponsored (featured) restaurants matching active promotions, in promo order.
 *    b) Top 3 rated restaurants (rating > 0, highest first; tie-break: totalOrders desc)
 *       excluding any already in featured.
 * 2. Rest group:
 *    All remaining restaurants in random order (Fisher-Yates shuffled).
 *
 * Guarantees no duplicates.
 */
export function orderRestaurants(
  restaurants: Restaurant[] = [],
  promotions: any[] = []
): OrderedRestaurantsResult {
  if (!Array.isArray(restaurants) || restaurants.length === 0) {
    return {
      featured: [],
      topRated: [],
      pinned: [],
      rest: [],
      ordered: [],
      featuredIds: [],
    };
  }

  const featuredIds = extractFeaturedRestaurantIds(promotions);

  // 1. Featured restaurants in promo order
  const featured: Restaurant[] = [];
  const featuredAddedSet = new Set<string>();

  for (const id of featuredIds) {
    const match = restaurants.find((r) => r._id === id);
    if (match && !featuredAddedSet.has(match._id)) {
      featured.push(match);
      featuredAddedSet.add(match._id);
    }
  }

  // 2. Top-rated restaurants (rating > 0, not featured, sorted desc, max 3)
  const topRatedCandidates = restaurants
    .filter((r) => !featuredAddedSet.has(r._id) && (Number(r.rating) || 0) > 0)
    .sort((a, b) => {
      const ratingDiff = (Number(b.rating) || 0) - (Number(a.rating) || 0);
      if (ratingDiff !== 0) return ratingDiff;
      // Tie-breaker: totalOrders desc
      return (Number(b.totalOrders) || 0) - (Number(a.totalOrders) || 0);
    });

  const topRated = topRatedCandidates.slice(0, 3);
  const topRatedAddedSet = new Set(topRated.map((r) => r._id));

  // Pinned group (featured + topRated)
  const pinned = [...featured, ...topRated];
  const pinnedIdSet = new Set([...featuredAddedSet, ...topRatedAddedSet]);

  // 3. Rest group: all other restaurants, shuffled with Fisher-Yates
  const restCandidates = restaurants.filter((r) => !pinnedIdSet.has(r._id));
  const rest = fisherYatesShuffle(restCandidates);

  // Final combined list
  const ordered = [...pinned, ...rest];

  return {
    featured,
    topRated,
    pinned,
    rest,
    ordered,
    featuredIds,
  };
}
