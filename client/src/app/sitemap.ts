import { MetadataRoute } from 'next';
import { GROCERY_CATEGORIES_MAP } from '@/lib/groceryCategories';
import { SITE_URL } from '@/lib/constants';

const CATEGORIES = Object.keys(GROCERY_CATEGORIES_MAP);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  // Core public routes
  const staticRoutes = [
    '',
    '/restaurants',
    '/grocery',
    '/register-partner',
    '/register-delivery',
    '/auth/login',
    '/about-us',
    '/contact-us',
    '/terms-and-conditions',
    '/privacy-policy',
    '/refund-policy',
    '/shipping-policy',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: (route === '' ? 'daily' : 'weekly') as 'daily' | 'weekly',
    priority: route === '' ? 1.0 : 0.8,
  }));

  // Static Grocery Category routes
  const groceryCategoryRoutes = CATEGORIES.map((cat) => ({
    url: `${baseUrl}/grocery/category/${encodeURIComponent(cat)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // Fetch approved active restaurants dynamically
  let restaurantRoutes: MetadataRoute.Sitemap = [];
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    const res = await fetch(`${apiUrl}/restaurants?status=approved&isActive=true`, {
      next: { revalidate: 3600 }, // cache for 1 hour
      signal: AbortSignal.timeout(5000), // 5 seconds timeout to prevent hanging the build
    });

    if (res.ok) {
      const data = await res.json();
      const restaurants = data.restaurants || data.data?.restaurants || [];
      restaurantRoutes = restaurants.map((r: any) => ({
        url: `${baseUrl}/restaurants/${r._id}`,
        lastModified: new Date(r.updatedAt || new Date()),
        changeFrequency: 'daily' as const,
        priority: 0.6,
      }));
    }
  } catch (error) {
    console.error("Failed to fetch restaurants for sitemap, falling back to static routes:", error);
  }

  return [...staticRoutes, ...groceryCategoryRoutes, ...restaurantRoutes];
}
