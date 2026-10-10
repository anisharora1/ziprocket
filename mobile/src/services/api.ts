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
    if (__DEV__) {
      console.error('[API Error]:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });
    }
    return Promise.reject(error);
  }
);
