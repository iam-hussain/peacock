import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

// DB-backed memo of read-DTOs (the "reduce live queries" layer). A key maps to the exact JSON a
// page/API returns; compute() is the existing query function, so there is never a second source of
// truth for money — just a stored copy of what the queries said.
//
// Freshness rules:
//   • any mutation calls bustStats() → every key is dropped, next read recomputes;
//   • a snapshot from a previous IST day is stale (daily interest / pending figures roll at midnight IST).

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // mirrors src/lib/date.ts (club runs on IST, no DST)

function startOfTodayIST(): Date {
  const shifted = new Date(Date.now() + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

/** Serve `key` from StatsCache, recomputing via `compute` when missing or stale. */
export async function cachedStats<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const hit = await prisma.statsCache.findUnique({ where: { key } });
  if (hit && hit.computedAt >= startOfTodayIST()) return hit.data as T;
  const data = await compute();
  if (data == null) return data; // don't memo misses (e.g. an unknown member id)
  const json = data as Prisma.InputJsonValue;
  await prisma.statsCache.upsert({
    where: { key },
    create: { key, data: json, computedAt: new Date() },
    update: { data: json, computedAt: new Date() },
  });
  return data;
}

/** Drop every cached snapshot. Called after ANY successful mutation — recomputes are cheap at club
 *  scale and "always correct" beats a per-action key map. ponytail: refine to per-key busting only
 *  if recompute cost ever shows up in profiles. */
export async function bustStats(): Promise<void> {
  await prisma.statsCache.deleteMany({});
}
