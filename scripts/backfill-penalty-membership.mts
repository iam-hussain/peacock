/**
 * One-off backfill: PENALTY transactions posted before the intents.ts fix were saved with
 * membershipId = null, orphaning them from the member. Recover the membership from the
 * Submission that posted the txn (payload.partyId / party), mirroring intents.ts resolution.
 *
 * Dry-run by default (prints a plan, writes nothing). Pass `--apply` to persist.
 *   node --env-file=.env --import tsx scripts/backfill-penalty-membership.mts [--apply]
 *
 * Admin-posted penalties have no Submission → no stored link → reported as unrecoverable,
 * never guessed. (Charge/amount/date heuristics are deliberately not used.)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Mirror intents.ts resolveMember + activeMembership exactly.
async function resolveMember(name?: string, id?: string) {
  if (id) return prisma.member.findUnique({ where: { id } });
  if (!name) return null;
  const [first, ...rest] = name.trim().split(/\s+/);
  return prisma.member.findFirst({ where: { firstName: first, lastName: rest.length ? rest.join(" ") : undefined } });
}
async function activeMembership(memberId: string) {
  return (
    (await prisma.membership.findFirst({ where: { memberId, status: "ACTIVE" }, orderBy: { seq: "desc" } })) ??
    (await prisma.membership.findFirst({ where: { memberId }, orderBy: { seq: "desc" } }))
  );
}

async function main() {
  const orphans = await prisma.transaction.findMany({
    where: { type: "PENALTY", membershipId: null },
    select: { id: true, occurredAt: true, description: true },
    orderBy: { occurredAt: "asc" },
  });
  console.log(`${orphans.length} orphaned PENALTY transaction(s) (membershipId = null).`);
  if (!orphans.length) return;

  const fixes: { id: string; membershipId: string; who: string }[] = [];
  const unrecoverable: { id: string; reason: string }[] = [];

  for (const txn of orphans) {
    const sub = await prisma.submission.findFirst({ where: { postedTxnId: txn.id }, select: { payload: true } });
    if (!sub) {
      unrecoverable.push({ id: txn.id, reason: "no Submission (admin-posted or imported)" });
      continue;
    }
    const p = sub.payload as { party?: string; partyId?: string };
    const member = await resolveMember(p.party, p.partyId);
    if (!member) {
      unrecoverable.push({ id: txn.id, reason: `member unresolved (party=${p.party ?? ""}, partyId=${p.partyId ?? ""})` });
      continue;
    }
    const ms = await activeMembership(member.id);
    if (!ms) {
      unrecoverable.push({ id: txn.id, reason: `no membership for ${member.firstName} ${member.lastName}` });
      continue;
    }
    fixes.push({ id: txn.id, membershipId: ms.id, who: `${member.firstName} ${member.lastName} (seq ${ms.seq})` });
  }

  console.log(`\nRecoverable: ${fixes.length}`);
  for (const f of fixes) console.log(`  ${f.id} → ${f.membershipId}  [${f.who}]`);
  if (unrecoverable.length) {
    console.log(`\nUnrecoverable: ${unrecoverable.length}`);
    for (const u of unrecoverable) console.log(`  ${u.id}  — ${u.reason}`);
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing written. Re-run with --apply to persist the ${fixes.length} fix(es).`);
    return;
  }
  for (const f of fixes) {
    await prisma.transaction.update({ where: { id: f.id }, data: { membershipId: f.membershipId } });
  }
  console.log(`\nApplied ${fixes.length} update(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
