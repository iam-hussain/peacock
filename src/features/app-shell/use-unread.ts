"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/use-page-query";
import type { CurrentUser } from "@/server/queries/session";

/** Bell badge count. Refetched on mutation invalidation like everything else. */
export function useUnread(): number {
  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchJson<{ user: CurrentUser; unread: number }>("/api/me"),
    staleTime: 60_000,
  });
  return data?.unread ?? 0;
}
