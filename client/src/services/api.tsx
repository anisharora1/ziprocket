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
  (response) => {
    // If the response is in our standard envelope, we merge data back into response.data
    if (response.data && response.data.success === true && response.data.data !== undefined) {
      const { success, message, data } = response.data;
      response.data = {
        success,
        message,
        ...data
      };
    }
    return response;
  },
  (error) => {
    // Log the actual original error with request context to the console (only in development)
    if (process.env.NODE_ENV !== "production") {
      console.error("[API Client Error Log]:", {
        message: error.message,
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        backendMessage: error.response?.data?.message || error.response?.data?.error,
        data: error.config?.data,
        response: error.response?.data,
      });
    }

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
const CACHE_TTL = 60 * 1000; // 60 seconds (1 minute)
const MAX_CACHE_SIZE = 50; // Prevent unbounded memory growth
const SESSION_CACHE_PREFIX = "ziprocket_api_cache_";

// Safe endpoints to cache
const SAFE_CACHE_ENDPOINTS = [
  "/restaurants",
  "/promotions",
  "/grocery",
  "/locations"
];

const shouldCache = (url: string | undefined): boolean => {
  if (!url) return false;
  if (url.includes("/admin")) return false; // Do not cache administrative endpoints
  return SAFE_CACHE_ENDPOINTS.some(endpoint => url.includes(endpoint));
};

const getCachedEntry = (cacheKey: string): CacheEntry | null => {
  // 1. Check in-memory map
  const memoryEntry = cache.get(cacheKey);
  if (memoryEntry) {
    if (Date.now() - memoryEntry.timestamp < CACHE_TTL) {
      return memoryEntry;
    } else {
      cache.delete(cacheKey);
    }
  }

  // 2. Check sessionStorage fallback (survives page refresh in same tab)
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(SESSION_CACHE_PREFIX + cacheKey);
      if (stored) {
        const parsed: CacheEntry = JSON.parse(stored);
        if (Date.now() - parsed.timestamp < CACHE_TTL) {
          cache.set(cacheKey, parsed); // populate in-memory cache
          return parsed;
        } else {
          sessionStorage.removeItem(SESSION_CACHE_PREFIX + cacheKey);
        }
      }
    } catch (e) {
      // Ignore sessionStorage exceptions
    }
  }

  return null;
};

const setCachedEntry = (cacheKey: string, data: any) => {
  // Evict oldest entry if over size limit (Map preserves insertion order)
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }

  const entry: CacheEntry = {
    data,
    timestamp: Date.now(),
  };
  cache.set(cacheKey, entry);

  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(SESSION_CACHE_PREFIX + cacheKey, JSON.stringify(entry));
    } catch (e) {
      // Ignore sessionStorage write errors (e.g. quota limit)
    }
  }
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
    const cached = getCachedEntry(cacheKey);
    if (cached) {
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
          setCachedEntry(cacheKey, response.data);
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
