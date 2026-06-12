import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://ziprocket.in';

  // Core public routes
  const routes = [
    '',
    '/restaurants',
    '/grocery',
    '/register-partner',
    '/register-delivery',
    '/auth/login',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'daily' : 'weekly',
    priority: route === '' ? 1.0 : 0.8,
  }));
}
