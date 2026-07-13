import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

// DB-backed memo of read-DTOs (the "reduce live queries" layer). A key maps to the exact JSON a
// page/API returns; compute() is the existing query function, so there is never a second source of
// truth for money — just a stored copy of what the queries said.
//
// Freshness rules:
//   • any mutation calls bustStats() → every key is dropped, next read recomputes;
//   • a snapshot from a previous IST day is stale (daily interest / pending figures roll at midnight IST);
//   • a snapshot whose compute STARTED before the last bust is stale — an in-flight read that
//     finishes after a mutation must not resurrect pre-mutation figures (the sentinel row + the
//     compute-start timestamp below make that write dead on arrival).

const BUST_KEY = "_bustedAt"; // sentinel row: computedAt = time of the last bust, data unused

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // mirrors src/lib/date.ts (club runs on IST, no DST)

function startOfTodayIST(): Date {
  const shifted = new Date(Date.now() + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

// Snapshots must never outlive the code that shaped them: a deploy that adds a DTO field would
// otherwise serve old-shape JSON and crash the new client. Prod keys are suffixed per deploy; dev
// keys per dev-server boot (globalThis survives HMR), so restarting the server drops old shapes
// while normal navigation still hits the cache instead of recomputing on every request.
const g = globalThis as unknown as { __statsBootId?: string };
const CODE_VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? (g.__statsBootId ??= Date.now().toString(36));

/** Serve `key` from StatsCache, recomputing via `compute` when missing or stale. */
export async function cachedStats<T>(rawKey: string, compute: () => Promise<T>): Promise<T> {
  const key = `${rawKey}@${CODE_VERSION}`;
  // One round-trip for the snapshot + the bust sentinel.
  const rows = await prisma.statsCache.findMany({ where: { key: { in: [key, BUST_KEY] } } });
  const hit = rows.find((r) => r.key === key);
  const bust = rows.find((r) => r.key === BUST_KEY);
  const freshAfter = Math.max(startOfTodayIST().getTime(), bust?.computedAt.getTime() ?? 0);
  if (hit && hit.computedAt.getTime() >= freshAfter) return hit.data as T;
  const started = new Date(); // stamp compute START, so a bust that lands mid-compute invalidates this write
  const data = await compute();
  if (data == null) return data; // don't memo misses (e.g. an unknown member id)
  const json = data as Prisma.InputJsonValue;
  await prisma.statsCache.upsert({
    where: { key },
    create: { key, data: json, computedAt: started },
    update: { data: json, computedAt: started },
  });
  return data;
}

/** Drop every cached snapshot. Called after ANY successful mutation — recomputes are cheap at club
 *  scale and "always correct" beats a per-action key map. ponytail: refine to per-key busting only
 *  if recompute cost ever shows up in profiles. */
export async function bustStats(): Promise<void> {
  // Sentinel first: anything computed before this instant is stale even if its upsert lands later.
  const now = new Date();
  await prisma.statsCache.upsert({
    where: { key: BUST_KEY },
    create: { key: BUST_KEY, data: {}, computedAt: now },
    update: { computedAt: now },
  });
  await prisma.statsCache.deleteMany({ where: { key: { not: BUST_KEY } } });
}
