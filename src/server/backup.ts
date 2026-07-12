"use server";

import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/queries/session";
import { bustStats } from "@/server/stats";

// Every table, in FK-safe insert order (parents first). Restore inserts in this order, skipping duplicates.
const TABLES = [
  "user", "member", "membership", "vendor", "chitFund", "ledgerAccount", "loan",
  "transaction", "entry", "charge", "clubConfig", "submission", "notification",
  "periodClose", "auditLog", "session", "account", "verification",
] as const;

// Minimal shape we invoke on each model delegate. Keyed by the exact TABLES names
// (camelCased Prisma delegate keys) so dynamic dispatch stays checked, not `any`.
type ModelDelegate = {
  findMany: (args?: object) => Promise<unknown[]>;
  createMany: (args: object) => Promise<unknown>;
};
type ModelClient = Record<(typeof TABLES)[number], ModelDelegate>;

// BigInt isn't JSON-serialisable; tag it so import can revive it losslessly.
const replacer = (_k: string, v: unknown) => (typeof v === "bigint" ? { __big: v.toString() } : v);
const reviver = (_k: string, v: unknown) =>
  v && typeof v === "object" && "__big" in (v as object) ? BigInt((v as { __big: string }).__big) : v;

/** Serialise the whole club DB to a JSON string (admin only). */
export async function exportBackup(): Promise<{ ok: boolean; json?: string; error?: string }> {
  const me = await getCurrentUser();
  if (!me?.isAdmin) return { ok: false, error: "Only an admin can export a backup." };
  const data: Record<string, unknown[]> = {};
  const models = prisma as unknown as ModelClient;
  for (const t of TABLES) {
    data[t] = await models[t].findMany();
  }
  return { ok: true, json: JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, replacer) };
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
          if (fresh.length) {
            const res = (await txModels[t].createMany({ data: fresh })) as { count: number };
            counts[t] = res.count;
          } else {
            counts[t] = 0;
          }
        }
      },
      { timeout: 30_000 },
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restore failed — no changes were made." };
  }
  await bustStats();
  return { ok: true, counts };
}
