import { prisma } from "@/server/db";
import { getPenaltyConfig, computeAutoPenalties } from "@/server/queries/penalties";

/**
 * Materialise any newly-due auto penalties as `Charge` rows (§13.2). Runs on every mutation that
 * could bring one into being (a deposit, an interest payment, the clock rolling forward at the next
 * add-entry) and when the admin edits the penalty config or hits "Sync now".
 *
 * Duplicate-proof by construction: each due penalty has a DETERMINISTIC id (apen_dep_…/apen_int_…),
 * so we fetch which ids already exist and create only the genuinely missing ones (via upsert, which
 * is atomic on the id, so even a concurrent sync can't write the same period twice). Existing rows
 * are never touched — the amount is frozen when first written. Returns how many were added.
 */
export async function syncAutoPenalties(today = new Date()): Promise<number> {
  const cfg = await getPenaltyConfig();
  if (!cfg.deposit.enabled && !cfg.interest.enabled) return 0;
  const due = await computeAutoPenalties(cfg, today);
  if (!due.length) return 0;

  const existing = new Set(
    (await prisma.charge.findMany({ where: { id: { in: due.map((d) => d.id) } }, select: { id: true } })).map((c) => c.id),
  );
  const missing = due.filter((d) => !existing.has(d.id));
  for (const d of missing) {
    await prisma.charge.upsert({
      where: { id: d.id },
      update: {}, // never overwrite an already-materialised penalty — amount stays frozen
      create: { id: d.id, membershipId: d.membershipId, kind: "PENALTY", reason: d.reason, amount: d.amount, occurredAt: d.occurredAt, note: d.note, auto: true },
    });
  }
  return missing.length;
}

/** Best-effort sync from inside a form action: never let a penalty-sync hiccup fail the user's
 *  actual mutation (the entry they were recording still succeeds; the next sync catches up). */
export async function syncAutoPenaltiesSafe(): Promise<void> {
  try {
    await syncAutoPenalties();
  } catch (e) {
    console.error("auto-penalty sync failed", e);
  }
}
