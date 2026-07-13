// Backfill Transaction.reversed (see prisma/schema.prisma). Prisma-on-Mongo never matches a
// missing key — neither `reversed: false` nor `reversed: { not: true }` sees legacy docs — so
// every doc needs the key written once. Idempotent; re-run any time (e.g. after a deploy window
// where old code created docs without the field).
//
//   node --env-file=.env --import tsx scripts/backfill-reversed.mts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const stamped = await prisma.$runCommandRaw({
  update: "Transaction",
  updates: [{ q: { reversed: { $exists: false } }, u: { $set: { reversed: false } }, multi: true }],
});
console.log("stamped reversed:false on docs missing the key:", (stamped as { nModified?: number }).nModified);

const reversals = await prisma.transaction.findMany({
  where: { type: "REVERSAL", reversesId: { not: null } },
  select: { reversesId: true },
});
const ids = reversals.map((r) => r.reversesId!).filter(Boolean);
const marked = await prisma.transaction.updateMany({ where: { id: { in: ids } }, data: { reversed: true } });
console.log(`marked ${marked.count} reversed originals (${ids.length} reversals found)`);

await prisma.$disconnect();
