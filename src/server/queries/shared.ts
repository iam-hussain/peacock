import "server-only";

// The suspense account that absorbs opening-import residual (see seed). Excluded
// from every activity feed / income total so it never shows to users.
export const OPENING_ACCOUNT_ID = "club-opening";

// Reversed originals (delete = one REVERSAL; edit = REVERSAL + corrected copy) are excluded from
// every sum filtered by the ORIGINAL type via `reversed: false` — the flag postTransaction sets on
// the original when its reversal posts (§16). Mongo note: legacy docs need the key stamped once —
// scripts/backfill-reversed.mts (idempotent, re-run after deploys of pre-flag code).

// Read caching lives in src/server/stats.ts (DB-backed StatsCache, busted on every mutation)
// + React Query on the client — not Next cache tags.
