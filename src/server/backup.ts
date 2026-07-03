"use server";

import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/queries/session";

// Every table, in FK-safe insert order (parents first). Restore deletes in reverse, re-inserts here.
const TABLES = [
  "user", "member", "membership", "vendor", "chitFund", "ledgerAccount", "loan",
  "transaction", "entry", "charge", "clubConfig", "submission", "notification",
  "periodClose", "auditLog", "session", "account", "verification",
] as const;

// BigInt isn't JSON-serialisable; tag it so import can revive it losslessly.
const replacer = (_k: string, v: unknown) => (typeof v === "bigint" ? { __big: v.toString() } : v);
const reviver = (_k: string, v: unknown) =>
  v && typeof v === "object" && "__big" in (v as object) ? BigInt((v as { __big: string }).__big) : v;

/** Serialise the whole club DB to a JSON string (admin only). */
export async function exportBackup(): Promise<{ ok: boolean; json?: string; error?: string }> {
  const me = await getCurrentUser();
  if (!me?.isAdmin) return { ok: false, error: "Only an admin can export a backup." };
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data[t] = await (prisma as any)[t].findMany();
  }
  return { ok: true, json: JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, replacer) };
}

/** Replace the entire DB from a backup JSON (admin only). All-or-nothing. */
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
        // Wipe children-first (reverse order), then repopulate parents-first.
        for (const t of [...TABLES].reverse()) await (tx as never as Record<string, { deleteMany: (a: object) => Promise<unknown> }>)[t].deleteMany({});
        for (const t of TABLES) {
          const rows = data[t] as object[];
          if (rows.length) await (tx as never as Record<string, { createMany: (a: object) => Promise<unknown> }>)[t].createMany({ data: rows });
          counts[t] = rows.length;
        }
      },
      { timeout: 30_000 },
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restore failed — no changes were made." };
  }
  return { ok: true, counts };
}
