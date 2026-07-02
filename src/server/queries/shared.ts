import "server-only";

// The suspense account that absorbs opening-import residual (see seed). Excluded
// from every activity feed / income total so it never shows to users.
export const OPENING_ACCOUNT_ID = "club-opening";

// ponytail: reads are dynamic (fresh every request) — fine at this scale. When a
// screen gets hot, wrap the query in unstable_cache tagged below and call
// revalidateTag after the matching mutation. Tags kept here so they stay one list.
export const TAGS = {
  members: "members",
  vendors: "vendors",
  loans: "loans",
  transactions: "transactions",
  dashboard: "dashboard",
  config: "config",
} as const;
