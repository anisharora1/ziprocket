import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 30s — avoids refetch spam on component mount
      staleTime: 30 * 1000,
      // Keep unused cache in memory for 5 minutes (survives tab-switch)
      gcTime: 5 * 60 * 1000,
      // Only retry once on error to avoid hammering a down API
      retry: 1,
      // Do not refetch when window regains focus — socket handles live updates
      refetchOnWindowFocus: false,
    },
  },
});
