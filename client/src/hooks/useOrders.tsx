'use client';

/**
 * useOrders.tsx
 *
 * Role-specific TanStack Query hooks for fetching order data.
 * Socket handlers call queryClient.setQueryData() for immediate optimistic
 * updates and queryClient.invalidateQueries() for background server sync.
 *
 * Query key convention:
 *   ['orders', 'customer', userId]
 *   ['orders', 'seller']
 *   ['orders', 'grocery']
 *   ['orders', 'delivery']
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api';

// ---------------------------------------------------------------------------
// Customer: /orders/user/:userId
// ---------------------------------------------------------------------------
export function useCustomerOrders(userId: string | undefined) {
  return useQuery({
    queryKey: ['orders', 'customer', userId],
    queryFn: async () => {
      const res = await apiClient.get(`/orders/user/${userId}`);
      return (res.data.orders ?? []) as any[];
    },
    enabled: !!userId,
    // Active orders are time-sensitive — treat as stale immediately so
    // invalidateQueries always triggers a fresh fetch.
    staleTime: 0,
  });
}

// ---------------------------------------------------------------------------
// Seller: /orders/my-orders
// ---------------------------------------------------------------------------
export function useSellerOrders() {
  return useQuery({
    queryKey: ['orders', 'seller'],
    queryFn: async () => {
      const res = await apiClient.get('/orders/my-orders');
      return (res.data.orders ?? []) as any[];
    },
    staleTime: 0,
  });
}

// ---------------------------------------------------------------------------
// Grocery Moderator: /orders/grocery
// ---------------------------------------------------------------------------
export function useGroceryOrders() {
  return useQuery({
    queryKey: ['orders', 'grocery'],
    queryFn: async () => {
      const res = await apiClient.get('/orders/grocery');
      return (res.data.orders ?? []) as any[];
    },
    staleTime: 0,
  });
}

// ---------------------------------------------------------------------------
// Delivery: parallel fetch of active tasks + pending queue
// ---------------------------------------------------------------------------
interface DeliveryQueryData {
  activeTasks: any[];
  pendingQueue: any[];
}

export function useDeliveryData() {
  return useQuery<DeliveryQueryData>({
    queryKey: ['orders', 'delivery'],
    queryFn: async () => {
      const [tasksRes, queueRes] = await Promise.all([
        apiClient.get('/delivery/my-deliveries'),
        apiClient.get('/delivery/pending'),
      ]);
      return {
        activeTasks: (tasksRes.data.deliveries ?? []) as any[],
        pendingQueue: (queueRes.data.orders ?? []) as any[],
      };
    },
    staleTime: 0,
  });
}
