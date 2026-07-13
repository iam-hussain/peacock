import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { cronAuthorized } from "@/server/cron";
import { formatPaise } from "@/lib/money";
import { expectedClubDeposit, type Stage } from "@/server/queries/members";

// Monthly deposit reminder (vercel.json cron, 25th ~9:30 IST): every active member whose periodic
// deposits are behind the club-life baseline gets ONE in-app notification per calendar month —
// before the 1st-of-month auto-penalty tick (§13.2) can bite. Surfaces in the bell as an alert.
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const [cfg, active, periodic] = await Promise.all([
    prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { stages: true } }),
    prisma.membership.findMany({
      where: { status: "ACTIVE" },
      select: { memberId: true, accounts: { where: { kind: "MEMBER_EQUITY" }, select: { id: true } } },
    }),
    prisma.entry.groupBy({
      by: ["accountId"],
      _sum: { amount: true },
      where: { account: { kind: "MEMBER_EQUITY" }, transaction: { type: "PERIODIC_DEPOSIT", reversed: false } },
    }),
  ]);
  const expected = expectedClubDeposit((cfg?.stages as Stage[] | undefined) ?? []);
  const paidByAcct = new Map(periodic.map((d) => [d.accountId, -(d._sum.amount ?? 0n)])); // equity is credit → negate

  // One reminder per member per calendar month (cron retries / manual runs stay idempotent).
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const reminded = new Set(
    (
      await prisma.notification.findMany({
        where: { type: "deposit.reminder", createdAt: { gte: monthStart } },
        select: { recipientId: true },
      })
    ).map((n) => n.recipientId),
  );

  const due = active.flatMap((ms) => {
    const paid = ms.accounts[0] ? paidByAcct.get(ms.accounts[0].id) ?? 0n : 0n;
    const pending = expected - paid;
    if (pending <= 0n || reminded.has(ms.memberId)) return [];
    return [
      {
        recipientId: ms.memberId,
        kind: "EVENT" as const,
        type: "deposit.reminder",
        title: "Monthly deposit reminder",
        body: `${formatPaise(pending)} deposit pending — pay before the 1st to avoid a penalty.`,
        link: `/members/${ms.memberId}`,
      },
    ];
  });
  if (due.length) await prisma.notification.createMany({ data: due });
  return NextResponse.json({ ok: true, reminded: due.length });
}
