'use client';

import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

let browserQueryClient: QueryClient | undefined;

export function Providers({ children }: { children: ReactNode }) {
  const queryClient =
    typeof window === 'undefined'
      ? new QueryClient()
      : (browserQueryClient ??= new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider defaultColorScheme="light">{children}</MantineProvider>
    </QueryClientProvider>
  );
}
