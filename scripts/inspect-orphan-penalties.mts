import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const orphans = await prisma.transaction.findMany({
    where: { type: "PENALTY", membershipId: null },
    select: { id: true, occurredAt: true, description: true, entries: { select: { amount: true, account: { select: { kind: true } } } } },
    orderBy: { occurredAt: "asc" },
  });
  console.log("=== Orphaned PENALTY transactions ===");
  for (const t of orphans) {
    const mag = t.entries.find((e) => e.account.kind === "TREASURY_CASH")?.amount ?? 0n;
    console.log(`${t.id}  ${t.occurredAt.toISOString().slice(0, 10)}  ₹${(Number(mag) / 100).toFixed(2)}  desc=${JSON.stringify(t.description)}`);
  }

  const charges = await prisma.charge.findMany({
    where: { kind: "PENALTY" },
    select: { id: true, membershipId: true, amount: true, createdAt: true, membership: { select: { member: { select: { firstName: true, lastName: true } } } } },
  });
  console.log(`\n=== PENALTY Charge rows (${charges.length}) ===`);
  for (const c of charges) {
    const who = c.membership?.member ? `${c.membership.member.firstName} ${c.membership.member.lastName}` : "?";
    console.log(`${c.id}  ms=${c.membershipId}  ₹${(Number(c.amount) / 100).toFixed(2)}  ${c.createdAt.toISOString().slice(0, 10)}  [${who}]`);
  }

  const total = await prisma.transaction.count({ where: { type: "PENALTY" } });
  console.log(`\nTotal PENALTY transactions in DB: ${total} (of which ${orphans.length} orphaned)`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
