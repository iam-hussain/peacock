"use server";

import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/queries/session";
import { bustStats } from "@/server/stats";
import { TABLES, buildBackupJson, reviver, type ModelClient } from "@/server/backup-data";

/** Serialise the whole club DB to a JSON string (admin only). */
export async function exportBackup(): Promise<{ ok: boolean; json?: string; error?: string }> {
  const me = await getCurrentUser();
  if (!me?.isAdmin) return { ok: false, error: "Only an admin can export a backup." };
  return { ok: true, json: await buildBackupJson() };
}

/** Merge a backup JSON into the DB (admin only), skipping rows whose id already exists. All-or-nothing. */
export async function importBackup(json: string): Promise<{ ok: boolean; error?: string; counts?: Record<string, number> }> {
  const me = await getCurrentUser();
  if (!me?.isAdmin) return { ok: false, error: "Only an admin can restore a backup." };
  let parsed: { data?: Record<string, unknown[]> };
  try {
    parsed = JSON.parse(json, reviver);
  } catch {
    return { ok: false, error: "That file isn't valid backup JSON." };
  }
  const data = parsed.data;
  if (!data || typeof data !== "object") return { ok: false, error: "Backup is missing its data section." };
  for (const t of TABLES) if (!Array.isArray(data[t])) return { ok: false, error: `Backup is missing the "${t}" table.` };

  const counts: Record<string, number> = {};
  try {
    await prisma.$transaction(
      async (tx) => {
        const txModels = tx as unknown as ModelClient;
        // Insert parents-first, skipping rows whose id already exists (Mongo has no skipDuplicates,
        // so filter against existing ids up front).
        for (const t of TABLES) {
          const rows = data[t] as { id: string }[];
          const existing = new Set(((await txModels[t].findMany({ select: { id: true } })) as { id: string }[]).map((r) => r.id));
          const fresh = rows.filter((r) => !existing.has(r.id));
          // Old backups predate Charge.voidedAt; write the explicit null the live-due reads filter on.
          if (t === "charge") for (const r of fresh as { voidedAt?: unknown }[]) r.voidedAt ??= null;
          // Old backups also predate Transaction.reversed — stamp the default, then re-derive the
          // flag from the restored REVERSAL rows below (a missing key never matches on Mongo).
          if (t === "transaction") for (const r of fresh as { reversed?: unknown }[]) r.reversed ??= false;
          if (fresh.length) {
            const res = (await txModels[t].createMany({ data: fresh })) as { count: number };
            counts[t] = res.count;
          } else {
            counts[t] = 0;
          }
        }
        const reversedIds = (data.transaction as { type?: string; reversesId?: string | null }[])
          .filter((r) => r.type === "REVERSAL" && r.reversesId)
          .map((r) => r.reversesId!);
        if (reversedIds.length)
          await tx.transaction.updateMany({ where: { id: { in: reversedIds } }, data: { reversed: true } });
      },
      { timeout: 30_000 },
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restore failed — no changes were made." };
  }
  await bustStats();
  return { ok: true, counts };
}
