import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { auth } from '../services/firebase';
import { apiClient, setOnUnauthorized } from '../services/api';

export interface User {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'customer' | 'seller' | 'delivery' | 'grocery_moderator' | 'admin' | string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to decode JWT payload safely without external dependencies
const parseJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    // Polyfill decoding for react-native
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('user');
    } catch (e) {
      console.warn('[AuthContext] Error clearing SecureStore:', e);
    }
    try {
      await auth().signOut();
    } catch {
      // Ignore if Firebase auth is already signed out
    }
    setToken(null);
    setUser(null);
    delete apiClient.defaults.headers.common['Authorization'];
  }, []);

  const login = useCallback(async (newToken: string, newUser: User) => {
    try {
      await SecureStore.setItemAsync('token', newToken);
      await SecureStore.setItemAsync('user', JSON.stringify(newUser));
    } catch (e) {
      console.warn('[AuthContext] Error persisting token to SecureStore:', e);
    }
    setToken(newToken);
    setUser(newUser);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  }, []);

  // Register unauthorized callback with API client
  useEffect(() => {
    setOnUnauthorized(logout);
    return () => {
      setOnUnauthorized(null);
    };
  }, [logout]);

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('token');
        const storedUser = await SecureStore.getItemAsync('user');

        if (storedToken && storedUser) {
          const payload = parseJwt(storedToken);
          const currentTime = Math.floor(Date.now() / 1000);

          if (!payload || (payload.exp && payload.exp < currentTime)) {
            await logout();
            setIsLoading(false);
            return;
          }

          setToken(storedToken);
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;

          // Silently revalidate user profile with backend
          apiClient
            .get('/auth/me')
            .then(async (res) => {
              if (res.data?.success && res.data?.user) {
                const freshUser = res.data.user;
                setUser(freshUser);
                await SecureStore.setItemAsync('user', JSON.stringify(freshUser));
              }
            })
            .catch(async (err) => {
              if (err.response?.status === 401 || err.response?.status === 403) {
                await logout();
              }
            });
        }
      } catch (err) {
        console.warn('[AuthContext] Bootstrap error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAuth();
  }, [logout]);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      login,
      logout,
    }),
    [user, token, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
