import "server-only";

// The suspense account that absorbs opening-import residual (see seed). Excluded
// from every activity feed / income total so it never shows to users.
export const OPENING_ACCOUNT_ID = "club-opening";

// ponytail: reads are dynamic (fresh every request) — fine at this scale. Caching is a deliberate
// follow-up: on Next 16 it means the `'use cache'` + cacheTag model under `cacheComponents`, NOT the
// legacy unstable_cache (whose invalidation vs the new 2-arg revalidateTag is unverified). Tags kept
// here so they stay one list for that migration.
export const TAGS = {
  members: "members",
  vendors: "vendors",
  loans: "loans",
  transactions: "transactions",
  dashboard: "dashboard",
  config: "config",
} as const;
