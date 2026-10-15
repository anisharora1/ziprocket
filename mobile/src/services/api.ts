import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://ziprocket-backend.onrender.com/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

let onUnauthorizedCallback: (() => void) | null = null;
let isHandlingUnauthorized = false;

export const setOnUnauthorized = (callback: (() => void) | null) => {
  onUnauthorizedCallback = callback;
};

// Request interceptor: Attach JWT Bearer token from SecureStore
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('[API Client] Failed to read token from SecureStore:', e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Unpack envelope if backend returns { success, message, data: { ... } }
apiClient.interceptors.response.use(
  (response) => {
    if (
      response.data &&
      response.data.success === true &&
      response.data.data !== undefined
    ) {
      const { success, message, data } = response.data;
      response.data = {
        success,
        message,
        ...data,
      };
    }
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isCart401 = status === 401 && url.includes('/cart');

    // Only log errors in __DEV__ if not a /cart 401
    if (__DEV__ && !isCart401) {
      console.error('[API Error]:', {
        url,
        method: error.config?.method,
        status,
        message: error.response?.data?.message || error.message,
      });
    }

    // On 401 from any request that carried a token, trigger onUnauthorized once
    const carriedToken = !!error.config?.headers?.Authorization;
    if (status === 401 && carriedToken && onUnauthorizedCallback && !isHandlingUnauthorized) {
      isHandlingUnauthorized = true;
      try {
        onUnauthorizedCallback();
      } catch (e) {
        console.warn('[API Client] onUnauthorized handler error:', e);
      } finally {
        setTimeout(() => {
          isHandlingUnauthorized = false;
        }, 3000);
      }
    }

    return Promise.reject(error);
  }
);
