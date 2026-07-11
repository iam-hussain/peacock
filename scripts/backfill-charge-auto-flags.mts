/**
 * One-off backfill for the auto-penalty feature (PR: auto deposit & loan-interest penalties).
 *
 * MongoDB does not add new schema fields to existing documents, so `Charge` rows written before
 * this feature have no `auto` / `voidedAt` keys. The app's reads treat a missing `auto` as an error
 * when it is selected, and rely on `voidedAt: null` to count live dues. This script writes the
 * defaults onto every pre-existing charge so those reads are unambiguous.
 *
 * Only touches MANUAL charges (reason not one of the AUTO_* reasons), so re-running it can never
 * reset a real auto penalty. Idempotent.
 *
 * Dry-run by default (prints a plan, writes nothing). Pass `--apply` to persist.
 *   node --env-file=.env --import tsx scripts/backfill-charge-auto-flags.mts [--apply]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const AUTO_REASONS = ["AUTO_DEPOSIT_PENALTY", "AUTO_LOAN_INTEREST_PENALTY"];

async function main() {
  const total = await prisma.charge.count();
  const auto = await prisma.charge.count({ where: { reason: { in: AUTO_REASONS } } });
  console.log(`${total} charge(s) total · ${auto} auto · ${total - auto} manual to normalise.`);

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing written. Re-run with --apply to set { auto: false, voidedAt: null } on the manual charges.`);
    return;
  }
  const res = await prisma.charge.updateMany({
    where: { reason: { notIn: AUTO_REASONS } },
    data: { auto: false, voidedAt: null },
  });
  console.log(`\nApplied — normalised ${res.count} charge(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
