import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  QueryClient,
  defaultShouldDehydrateQuery,
  Query,
} from '@tanstack/react-query';
import Constants from 'expo-constants';
import { isNetworkError } from './api';

export const CACHE_BUSTER = Constants.expoConfig?.version || '1.0.0';
export const CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours

/**
 * Public catalog query key prefixes permitted in the offline cache.
 * Excludes all private/user-specific data (orders, cart, profile, addresses, etc.).
 */
export const PERSISTED_QUERY_KEYS = [
  'home-restaurants',
  'restaurant',
  'restaurant-menu',
  'hero-promotions',
  'promotions',
  'popular-groceries-home',
  'grocery-featured',
  'grocery-recent',
  'grocery-category-products',
  'grocery-search',
  'platform-settings',
  'platform',
  'grocery-categories',
  'categories',
] as const;

const ALLOWED_QUERY_KEY_PREFIXES = new Set<string>(PERSISTED_QUERY_KEYS);

const FORBIDDEN_QUERY_KEY_PREFIXES = new Set<string>([
  'orders',
  'cart',
  'profile',
  'addresses',
  'auth',
  'notification',
  'notifications',
  'user',
  'account',
  'locations',
]);

/**
 * Filter function for query cache persistence.
 * Ensures only successful, non-sensitive public catalog queries are saved to AsyncStorage.
 */
export const shouldDehydrateQuery = (query: Query): boolean => {
  if (!defaultShouldDehydrateQuery(query)) {
    return false;
  }

  const firstKey = query.queryKey[0];
  if (typeof firstKey !== 'string') {
    return false;
  }

  // Deny any query keys associated with user or sensitive data
  if (FORBIDDEN_QUERY_KEY_PREFIXES.has(firstKey)) {
    return false;
  }

  // Only allow explicitly whitelisted public catalog queries
  return ALLOWED_QUERY_KEY_PREFIXES.has(firstKey);
};

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'ZIPROCKET_OFFLINE_CACHE',
  throttleTime: 1000,
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: CACHE_MAX_AGE,
      staleTime: 1000 * 60 * 2, // 2 minutes
      refetchOnReconnect: 'always',
      retry: (failureCount: number, error: any) => {
        // Never retry 4xx errors
        const status = error?.response?.status;
        if (typeof status === 'number' && status >= 400 && status < 500) {
          return false;
        }

        // Do NOT retry network errors more than once (1 retry: failureCount === 0)
        if (isNetworkError(error)) {
          return failureCount < 1;
        }

        // Keep at most 2 retries for 5xx errors (retry 1: failureCount 0, retry 2: failureCount 1)
        if (typeof status === 'number' && status >= 500 && status < 600) {
          return failureCount < 2;
        }

        // Default fallback for any other error: at most 2 retries
        return failureCount < 2;
      },
    },
  },
});

/**
 * Clears the in-memory React Query cache and removes the persisted cache from AsyncStorage.
 * Invoked on user logout and after account deletion.
 */
export const clearPersistedCache = async (): Promise<void> => {
  try {
    queryClient.clear();
    await asyncStoragePersister.removeClient();
  } catch (err) {
    if (__DEV__) {
      console.warn('[Cache] Failed to clear persisted cache:', err);
    }
  }
};
