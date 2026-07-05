import { QueryClient } from "@tanstack/react-query";

// One browser-side QueryClient. Module-level (not React state) so non-component code —
// the action wrappers in actions-client.ts — can invalidate after mutations.
let client: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  client ??= new QueryClient({
    defaultOptions: {
      // Fresh for 30s (snappy back-nav, no refetch storm), kept 5min, one retry.
      queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1 },
    },
  });
  return client;
}
