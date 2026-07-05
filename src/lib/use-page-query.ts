"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

/** JSON fetcher for the app's own API routes. 401 = session expired → back to login. */
export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 401) {
    window.location.href = "/login";
    return new Promise<T>(() => {}); // page is navigating away; never settle
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** One page = one query. Key doubles as the invalidation handle (mutations invalidate everything). */
export function usePageQuery<T>(key: readonly unknown[], url: string): UseQueryResult<T> {
  return useQuery({ queryKey: key, queryFn: () => fetchJson<T>(url) });
}
