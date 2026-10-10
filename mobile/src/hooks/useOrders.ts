import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';

/**
 * Customer orders query hook for mobile.
 * Hits GET /orders/user/:userId
 */
export function useCustomerOrders(userId: string | undefined) {
  return useQuery({
    queryKey: ['orders', 'customer', userId],
    queryFn: async () => {
      const res = await apiClient.get(`/orders/user/${userId}`);
      return (res.data?.orders ?? []) as any[];
    },
    enabled: !!userId,
    staleTime: 0,
  });
}
