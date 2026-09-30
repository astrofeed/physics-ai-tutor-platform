"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffectiveSession } from "@/lib/effective-session-context";

function PresentationQueryProvider({ children }: { children: React.ReactNode }) {
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

export default function PresentationGradingLayout({ children }: { children: React.ReactNode }) {
  const session = useEffectiveSession();
  return <PresentationQueryProvider key={`${session.id}:${session.role}`}>{children}</PresentationQueryProvider>;
}
