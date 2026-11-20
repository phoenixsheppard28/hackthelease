"use client";

import { useState } from "react";
import { MantineProvider, createTheme } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const theme = createTheme({
  fontFamily: 'Apercu Pro, sans-serif',
  headings: { fontFamily: 'Apercu Pro, sans-serif' },
  primaryColor: "dark",
  defaultRadius: 6,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  }));
  return (
    <QueryClientProvider client={client}>
      <MantineProvider theme={theme} forceColorScheme="light">
        {children}
      </MantineProvider>
    </QueryClientProvider>
  );
}
