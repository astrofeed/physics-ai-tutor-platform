"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffectiveSession } from "@/lib/effective-session-context";

function QueryCache({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: (count, error) => !("status" in error && Number(error.status) < 500) && count < 1,
      },
    },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function SessionQueryProvider({ children }: { children: React.ReactNode }) {
  const session = useEffectiveSession();
  return <QueryCache key={`${session.id}:${session.role}`}>{children}</QueryCache>;
}
