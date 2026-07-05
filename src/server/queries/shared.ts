import "server-only";
import { prisma } from "@/server/db";

// The suspense account that absorbs opening-import residual (see seed). Excluded
// from every activity feed / income total so it never shows to users.
export const OPENING_ACCOUNT_ID = "club-opening";

// Ids of originals that have since been reversed (delete = one REVERSAL; edit = REVERSAL +
// corrected copy). A reversal posts type=REVERSAL, so any sum filtered by the ORIGINAL type
// (deposits, catch-up/penalty pay-downs, loan interest, …) would keep counting the reversed
// original and never see the negating leg. Every such query must exclude these ids so a
// deleted/edited row actually drops out — same rule the ledger feed already applies (§16).
export async function reversedTxnIds(): Promise<string[]> {
  const rows = await prisma.transaction.findMany({
    where: { type: "REVERSAL", reversesId: { not: null } },
    select: { reversesId: true },
  });
  return rows.map((r) => r.reversesId!).filter(Boolean);
}

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
