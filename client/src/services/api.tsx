import axios from "axios";
import { getFriendlyErrorMessage } from "@/utils/errorHandler";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// Create a customized axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to attach authentication token
apiClient.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor to map technical/raw errors to friendly ones
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const friendlyMessage = getFriendlyErrorMessage(error);
    error.message = friendlyMessage;
    if (error.response && error.response.data) {
      error.response.data.message = friendlyMessage;
    }
    return Promise.reject(error);
  }
);


// Caching and Deduplication cache stores
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<any>>();
const CACHE_TTL = 10 * 1000; // 10 seconds

// Safe endpoints to cache
const SAFE_CACHE_ENDPOINTS = [
  "/restaurants",
  "/promotions",
  "/grocery",
  "/locations"
];

const shouldCache = (url: string | undefined): boolean => {
  if (!url) return false;
  return SAFE_CACHE_ENDPOINTS.some(endpoint => url.includes(endpoint));
};

// Axios adapter wrapper to support caching and deduplication
apiClient.defaults.adapter = async (config) => {
  // Resolve the actual adapter function using Axios's built-in resolver
  const adapter = axios.getAdapter(
    (config.adapter && config.adapter !== apiClient.defaults.adapter)
      ? config.adapter
      : axios.defaults.adapter
  );

  // Only apply caching and deduplication to GET requests on client side
  if (config.method?.toLowerCase() !== "get" || typeof window === "undefined") {
    return adapter(config);
  }

  // Generate a unique cache key based on URL, params, and headers (for auth separation)
  const authHeader = config.headers?.Authorization || "";
  const cacheKey = `${config.url}?${JSON.stringify(config.params || {})}&auth=${authHeader}`;

  // 1. Check Cache
  if (shouldCache(config.url)) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return {
        data: cached.data,
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    }
  }

  // 2. Check in-flight requests (deduplication)
  let promise = inFlightRequests.get(cacheKey);
  if (!promise) {
    const activePromise = adapter(config).then(
      (response: any) => {
        // Remove from in-flight
        inFlightRequests.delete(cacheKey);
        
        // Cache if it is a safe endpoint and successful
        if (shouldCache(config.url) && response.status === 200) {
          cache.set(cacheKey, {
            data: response.data,
            timestamp: Date.now(),
          });
        }
        return response;
      },
      (error: any) => {
        // Remove from in-flight and propagate error
        inFlightRequests.delete(cacheKey);
        throw error;
      }
    );
    inFlightRequests.set(cacheKey, activePromise);
    promise = activePromise;
  }

  if (!promise) {
    throw new Error("Request promise initialization failed");
  }

  // Return the resolved or in-flight promise clone
  return promise.then((res: any) => ({ ...res }));
};
