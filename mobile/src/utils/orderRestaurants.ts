import { Restaurant } from '../types';

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
 * For the TopRated section:
 * Sponsored (featured) restaurants matching active promotions in promo order,
 * followed by up to 3 highest-rated restaurants (rating > 0, highest first; tie-break: totalOrders desc)
 * that are not already featured.
 */
export function getTopRatedSectionRestaurants(
  restaurants: Restaurant[] = [],
  promotions: any[] = []
): Restaurant[] {
  if (!Array.isArray(restaurants) || restaurants.length === 0) {
    return [];
  }

  const featuredIds = extractFeaturedRestaurantIds(promotions);
  const featured: Restaurant[] = [];
  const featuredAddedSet = new Set<string>();

  for (const id of featuredIds) {
    const match = restaurants.find((r) => r._id === id);
    if (match && !featuredAddedSet.has(match._id)) {
      featured.push(match);
      featuredAddedSet.add(match._id);
    }
  }

  const topRated = restaurants
    .filter((r) => !featuredAddedSet.has(r._id) && (Number(r.rating) || 0) > 0)
    .sort((a, b) => {
      const ratingDiff = (Number(b.rating) || 0) - (Number(a.rating) || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (Number(b.totalOrders) || 0) - (Number(a.totalOrders) || 0);
    })
    .slice(0, 3);

  return [...featured, ...topRated];
}

/**
 * For the main Restaurants list (RestaurantList data):
 * final list = [ ...featured restaurants, ...all other restaurants shuffled ]
 *
 * - featured = restaurants whose _id is in active restaurant-type promotions (in promo order).
 * - rest = EVERY other restaurant (including highest-rated ones), shuffled with Fisher-Yates.
 *   Top 3 rated restaurants are NOT pinned in this list. They are shuffled with everyone else.
 * - No duplicates: a featured restaurant does not appear again in the random part.
 */
export function getHomeRestaurantList(
  restaurants: Restaurant[] = [],
  promotions: any[] = []
): Restaurant[] {
  if (!Array.isArray(restaurants) || restaurants.length === 0) {
    return [];
  }

  const featuredIds = extractFeaturedRestaurantIds(promotions);
  const featured: Restaurant[] = [];
  const featuredAddedSet = new Set<string>();

  for (const id of featuredIds) {
    const match = restaurants.find((r) => r._id === id);
    if (match && !featuredAddedSet.has(match._id)) {
      featured.push(match);
      featuredAddedSet.add(match._id);
    }
  }

  // Rest = every other restaurant (including rated ones), shuffled with Fisher-Yates
  const restCandidates = restaurants.filter((r) => !featuredAddedSet.has(r._id));
  const rest = fisherYatesShuffle(restCandidates);

  return [...featured, ...rest];
}

/**
 * Backward-compatible helper returning structured groups if needed.
 */
export function orderRestaurants(
  restaurants: Restaurant[] = [],
  promotions: any[] = []
) {
  const topRated = getTopRatedSectionRestaurants(restaurants, promotions);
  const homeList = getHomeRestaurantList(restaurants, promotions);
  return {
    pinned: topRated,
    ordered: homeList,
  };
}
