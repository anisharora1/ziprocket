'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiClient } from '../services/api';

interface User {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'customer' | 'seller' | 'delivery' | 'grocery_moderator' | 'admin';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to check if PWA is running in standalone mode
const getIsPwa = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone ||
    document.referrer.includes('android-app://')
  );
};

// Helper to decode JWT client-side without external dependencies
const parseJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        const payload = parseJwt(storedToken);
        if (!payload || !payload.exp) {
          logout();
          setIsLoading(false);
          return;
        }

        const currentTime = Math.floor(Date.now() / 1000);
        if (payload.exp < currentTime) {
          logout();
          setIsLoading(false);
          return;
        }

        // Rehydrate immediate token and user in memory and client defaults
        setToken(storedToken);
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;

        // Silently fetch fresh user profile from backend to update role or details
        apiClient.get('/auth/me')
          .then((res) => {
            if (res.data.success && res.data.user) {
              const freshUser = res.data.user;
              setUser(freshUser);
              localStorage.setItem('user', JSON.stringify(freshUser));
            }
          })
          .catch((err) => {
            console.error('[Auth] Failed to refresh profile on startup:', err);
            // If the token is invalid/unauthorized (e.g. status 401 or 403), perform logout
            if (err.response?.status === 401 || err.response?.status === 403) {
              logout();
            }
          });

        // If the token is expiring in less than 3 days, refresh it in the background
        const threeDaysInSec = 3 * 24 * 60 * 60;
        if (payload.exp - currentTime < threeDaysInSec) {
          try {
            const isPwa = getIsPwa();
            const res = await apiClient.post('/auth/refresh', { isPwa });
            if (res.data.success) {
              const newToken = res.data.token;
              const newUser = res.data.user;
              setToken(newToken);
              setUser(newUser);
              localStorage.setItem('token', newToken);
              localStorage.setItem('user', JSON.stringify(newUser));
              apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
              console.log('[Auth] Token silently refreshed successfully.');
            }
          } catch (err: any) {
            console.error('[Auth] Failed to refresh token silently:', err);
            if (err.response?.status === 401 || err.response?.status === 403) {
              logout();
            }
          }
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete apiClient.defaults.headers.common['Authorization'];
    router.push('/auth/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
