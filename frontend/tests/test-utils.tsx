import * as React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { makeQueryClient } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';

/** Real providers (query client without retries, auth against the MSW-backed API). */
export function renderWithProviders(ui: React.ReactElement) {
  const client = makeQueryClient();
  client.setDefaultOptions({ queries: { retry: false, staleTime: 0, gcTime: 0 }, mutations: { retry: false } });
  return { client, ...render(<QueryClientProvider client={client}><AuthProvider>{ui}</AuthProvider></QueryClientProvider>) };
}

export const lastCall = <T extends unknown[]>(fn: { mock: { calls: T[] } }) => fn.mock.calls[fn.mock.calls.length - 1];
