/**
 * Native-schema backup & restore for THIS app's own data (not the legacy import).
 *
 * Once transform.mts has imported the old-app export into this schema, use this to
 * snapshot the live DB and seed it back — a true round-trip on the current models,
 * no reconciliation, no synthetic opening legs.
 *
 *   npm run db:backup            → dump every table to data/peacock-new-backup.json
 *   npm run db:seed:new          → wipe + restore that file into the DB
 *
 * BigInt scalars are stored as strings in JSON (BigInt is not JSON-serialisable) and
 * coerced back on restore using the Prisma DMMF, so the script stays generic as the
 * schema grows. DateTime accepts the ISO strings Prisma already emits.
 *
 * ponytail: no FK-disable trickery — ORDER below is a valid topological insert order,
 * so plain createMany works without deferred constraints or superuser session flags.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// DIRECT_URL only existed on Postgres (to bypass PgBouncer for bulk); on Mongo there is one URL.
// This makes the script the PG->Mongo migration tool: run `db:backup` on main (Postgres client +
// legacy URL), then `db:seed:new` on this branch to restore the same JSON into Mongo.
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL });
const FILE = fileURLToPath(new URL("../data/peacock-new-backup.json", import.meta.url));

// FK-safe insert order (parents before children). Reverse it to delete children first.
const ORDER = [
  "User", "Vendor", "Verification", "ClubConfig", "Transaction", "Submission", "PeriodClose", "Notification", "AuditLog",
  "Member", "Account", "Session", "ChitFund",
  "Membership",
  "LedgerAccount", "Loan", "Charge",
  "Entry",
] as const;

type Delegate = { findMany: () => Promise<Record<string, unknown>[]>; deleteMany: () => Promise<unknown>; createMany: (args: { data: Record<string, unknown>[] }) => Promise<unknown> };
const delegate = (model: string) => (prisma as unknown as Record<string, Delegate>)[model[0].toLowerCase() + model.slice(1)];

// { Model: [bigintFieldNames] } from the DMMF — drives backup serialisation and restore coercion.
const bigintFields = new Map<string, string[]>(
  Prisma.dmmf.datamodel.models.map((m) => [m.name, m.fields.filter((f) => f.type === "BigInt").map((f) => f.name)]),
);

async function backup() {
  const dump: Record<string, unknown[]> = {};
  for (const model of ORDER) dump[model] = await delegate(model).findMany();
  writeFileSync(FILE, JSON.stringify(dump, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  const total = Object.values(dump).reduce((n, rows) => n + rows.length, 0);
  console.log(`Backed up ${total} rows across ${ORDER.length} tables → ${FILE}`);
}

async function restore() {
  const dump: Record<string, Record<string, unknown>[]> = JSON.parse(readFileSync(FILE, "utf8"));
  for (const model of [...ORDER].reverse()) await delegate(model).deleteMany();
  await prisma.statsCache.deleteMany(); // snapshots of the old data are meaningless now
  let total = 0;
  for (const model of ORDER) {
    const bigints = bigintFields.get(model) ?? [];
    const rows = (dump[model] ?? []).map((row) => {
      for (const f of bigints) if (row[f] != null) row[f] = BigInt(row[f] as string | number);
      // Old dumps predate Charge.voidedAt; Mongo missing-key ≠ null and the live-due reads
      // filter `voidedAt: null`, so a restored charge without it would be invisible.
      if (model === "Charge") row.voidedAt ??= null;
      return row;
    });
    if (rows.length) {
      for (let i = 0; i < rows.length; i += 5000) await delegate(model).createMany({ data: rows.slice(i, i + 5000) });
      total += rows.length;
    }
  }
  console.log(`Restored ${total} rows across ${ORDER.length} tables from ${FILE}`);
}

await (process.argv[2] === "restore" ? restore() : backup());
await prisma.$disconnect();
