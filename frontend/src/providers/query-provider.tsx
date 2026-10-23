'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';

/** Retry only what can plausibly succeed later: network blips, timeouts and 5xx. Never 4xx (bad input, 401, 403, 404...). */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof ApiError) return error.isNetwork || error.status >= 500;
  return false; // aborted requests etc.
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        retryDelay: (n) => Math.min(1000 * 2 ** n, 5000),
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(makeQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
