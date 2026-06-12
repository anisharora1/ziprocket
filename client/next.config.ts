import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: false, // Handle registration manually in PwaManager.tsx for fine-grained update control
  fallbacks: {
    document: "/offline", // Serve our custom offline page when route is not cached and user is offline
  },
  workboxOptions: {
    skipWaiting: true,
    runtimeCaching: [
      // 1. Google Fonts stylesheets
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com/i,
        handler: "StaleWhileRevalidate" as const,
        options: {
          cacheName: "google-fonts-stylesheets",
        },
      },
      // 2. Google Fonts webfonts
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com/i,
        handler: "CacheFirst" as const,
        options: {
          cacheName: "google-fonts-webfonts",
          expiration: {
            maxEntries: 30,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // 3. Cloudinary images
      {
        urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
        handler: "CacheFirst" as const,
        options: {
          cacheName: "cloudinary-images",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // 4. Unsplash images
      {
        urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
        handler: "CacheFirst" as const,
        options: {
          cacheName: "unsplash-images",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // 5. Read-only API caching (Restaurants, Grocery items, Promotions/Banners, Delivery zones)
      // Excludes sensitive endpoints (auth, payment, cart, orders, addresses, payouts, moderator stats)
      {
        urlPattern: /\/api\/(restaurants|grocery(?!\/stats)|promotions|delivery-zones)/i,
        handler: "NetworkFirst" as const,
        options: {
          cacheName: "api-cache-network-first",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24, // 24 hours
          },
          networkTimeoutSeconds: 5, // fallback to cache if network doesn't respond in 5s
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // 6. Geocoding / Location APIs (rarely changes for coordinates, can be cached longer)
      {
        urlPattern: /\/api\/locations/i,
        handler: "StaleWhileRevalidate" as const,
        options: {
          cacheName: "api-cache-locations",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // 7. Static Assets (JS, CSS, Images, Fonts) from internal routes
      {
        urlPattern: /\.(?:js|css|woff2?|png|jpg|jpeg|svg|gif|ico)$/i,
        handler: "StaleWhileRevalidate" as const,
        options: {
          cacheName: "static-assets",
          expiration: {
            maxEntries: 150,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
        },
      },
      // 8. Pages / Documents (NetworkFirst to always show fresh pages, falling back to cache if offline)
      {
        urlPattern: ({ request }) => request.mode === "navigate",
        handler: "NetworkFirst" as const,
        options: {
          cacheName: "pages",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
          },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "cdn-icons-png.flaticon.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default withPWA(nextConfig);
