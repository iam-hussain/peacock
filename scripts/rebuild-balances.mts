/**
 * Repair/verify pass over the cached figures, for use after a migration or if a balance is ever
 * doubted:
 *   1. LedgerAccount.balance ← Σ Entry.amount (the ledger is the source of truth; balance is a cache)
 *   2. Loan.principalOutstanding is NOT touched (kept current transactionally; report-only here)
 *   3. StatsCache is emptied — every page snapshot lazily recomputes on next read
 *
 *   npx tsx --env-file=.env scripts/rebuild-balances.mts          → report drift only
 *   npx tsx --env-file=.env scripts/rebuild-balances.mts --write  → fix drifted balances too
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const write = process.argv.includes("--write");

const accounts = await prisma.ledgerAccount.findMany({ select: { id: true, kind: true, balance: true } });
const sums = await prisma.entry.groupBy({ by: ["accountId"], _sum: { amount: true } });
const sumById = new Map(sums.map((s) => [s.accountId, s._sum.amount ?? 0n]));

let drifted = 0;
for (const a of accounts) {
  const actual = sumById.get(a.id) ?? 0n;
  if (actual !== a.balance) {
    drifted++;
    console.log(`${a.kind} ${a.id}: cached ${a.balance} ≠ entries ${actual}${write ? " → fixed" : ""}`);
    if (write) await prisma.ledgerAccount.update({ where: { id: a.id }, data: { balance: actual } });
  }
}
await prisma.statsCache.deleteMany();
console.log(`${accounts.length} accounts checked, ${drifted} drifted${write ? " (fixed)" : ""}; stats cache cleared.`);
await prisma.$disconnect();
