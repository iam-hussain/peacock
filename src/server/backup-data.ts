import "server-only";
import { prisma } from "@/server/db";

// Every table, in FK-safe insert order (parents first). Restore inserts in this order, skipping duplicates.
export const TABLES = [
  "user", "member", "membership", "vendor", "chitFund", "ledgerAccount", "loan",
  "transaction", "entry", "charge", "clubConfig", "submission", "notification",
  "periodClose", "auditLog", "session", "account", "verification",
] as const;

// Minimal shape we invoke on each model delegate. Keyed by the exact TABLES names
// (camelCased Prisma delegate keys) so dynamic dispatch stays checked, not `any`.
export type ModelDelegate = {
  findMany: (args?: object) => Promise<unknown[]>;
  createMany: (args: object) => Promise<unknown>;
};
export type ModelClient = Record<(typeof TABLES)[number], ModelDelegate>;

// BigInt isn't JSON-serialisable; tag it so import can revive it losslessly.
export const replacer = (_k: string, v: unknown) => (typeof v === "bigint" ? { __big: v.toString() } : v);
export const reviver = (_k: string, v: unknown) =>
  v && typeof v === "object" && "__big" in (v as object) ? BigInt((v as { __big: string }).__big) : v;

/** Serialise the whole club DB to a JSON string. NOT auth-gated — callers gate: the admin export
 *  action checks the session, the backup cron checks CRON_SECRET. */
export async function buildBackupJson(): Promise<string> {
  const data: Record<string, unknown[]> = {};
  const models = prisma as unknown as ModelClient;
  for (const t of TABLES) {
    data[t] = await models[t].findMany();
  }
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, replacer);
}
