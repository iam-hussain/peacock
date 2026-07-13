import "server-only";
import { prisma } from "@/server/db";
import { formatPaise, formatLakh } from "@/lib/money";
import { daysBetween } from "@/lib/date";
import { getTransactions } from "./transactions";
import { getCurrentUser } from "./session";
import { ACTIVITY_PAGE, type ActivityEvent, type NotificationsData } from "@/features/notifications/types";
export async function getActivity(offset = 0, limit = ACTIVITY_PAGE): Promise<ActivityEvent[]> {
  const recent = await getTransactions(limit, offset);
  return recent.map((r) => ({
    title: `${r.what} · ${r.dir === "out" ? r.to.name : r.from.name}`,
    sub: `by ${r.dir === "out" ? r.from.name : r.to.name}`,
    time: r.entered,
    amt: r.amount,
    dir: r.dir,
  }));
}

/** Bell badge count = stored unread notifications for the signed-in member (cleared by "Mark all read"). */
export async function getUnreadCount(): Promise<number> {
  const me = await getCurrentUser();
  if (!me) return 0;
  return prisma.notification.count({ where: { recipientId: me.id, isRead: false } });
}

export async function getNotifications(): Promise<NotificationsData> {
  const me = await getCurrentUser(); // React-cached; also fetched by the route guard
  // Every read here is independent, so fetch them concurrently.
  const [mine, subs, overdue, catchupRaised, catchupPaid, runningChits, events] = await Promise.all([
    // Stored per-member EVENT notifications (deposit reminders, password-reset requests, …) —
    // unread only; "Mark all read" clears them. APPROVAL rows are excluded: those surface via the
    // pending-submissions list below.
    me
      ? prisma.notification.findMany({
          where: { recipientId: me.id, kind: "EVENT", isRead: false },
          orderBy: { createdAt: "desc" },
          select: { title: true, body: true },
        })
      : Promise.resolve([]),
    // Approvals ← pending submissions (none yet in a fresh import → empty list).
    prisma.submission.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" } }),
    // Alerts ← derived live from current state (overdue loans, pending deposits, chit due).
    prisma.loan.findMany({ where: { status: "ACTIVE" }, select: { principalOutstanding: true, startedAt: true, membership: { select: { member: { select: { firstName: true, lastName: true } } } } } }),
    // Pending deposits = catch-up raised − paid, per member. Raised charges…
    prisma.charge.groupBy({ by: ["membershipId"], where: { kind: "CATCHUP" }, _sum: { amount: true } }),
    // …and the pay-down legs (negative on MEMBER_EQUITY, see outstandingCharge), netted below.
    prisma.entry.findMany({ where: { transaction: { type: "CATCHUP", reversed: false }, account: { kind: "MEMBER_EQUITY" } }, select: { amount: true, transaction: { select: { membershipId: true } } } }),
    prisma.chitFund.findMany({ where: { status: "RUNNING" }, take: 1, select: { marginInstallment: true, durationMonths: true, vendor: { select: { name: true } } } }),
    // Events ← recent ledger activity (first page; "Load more" fetches the rest).
    getActivity(0),
  ]);

  const approvals = subs.map((s) => {
    const p = s.payload as Record<string, string>;
    return {
      id: s.id, who: p.party ?? "—", type: s.intent, sub: "awaiting your approval", amt: p.amount ?? "", dir: "in",
      creator: p.party ?? "—", treasurer: p.treasurer ?? "—", method: p.method ?? "Cash", txn: p.date ?? "", created: "",
    };
  });

  const alerts: { title: string; sub: string }[] = mine.map((n) => ({ title: n.title, sub: n.body ?? "" }));
  for (const l of overdue) {
    const days = daysBetween(l.startedAt, new Date());
    if (days > 150) {
      const name = [l.membership.member.firstName, l.membership.member.lastName].filter(Boolean).join(" ");
      alerts.push({ title: `${name}'s loan is overdue by ${days - 150} days`, sub: `${formatPaise(l.principalOutstanding)} principal pending · interest still accruing` });
    }
  }
  // Net raised − paid per member; count/sum only those still owing (pay-down legs are negative).
  const paidByMs = new Map<string, bigint>();
  for (const e of catchupPaid) {
    const ms = e.transaction.membershipId;
    if (ms) paidByMs.set(ms, (paidByMs.get(ms) ?? 0n) + e.amount);
  }
  let pendingCount = 0;
  let pendingTotal = 0n;
  for (const c of catchupRaised) {
    const net = (c._sum.amount ?? 0n) + (paidByMs.get(c.membershipId) ?? 0n);
    if (net > 0n) { pendingCount++; pendingTotal += net; }
  }
  if (pendingCount > 0) {
    alerts.push({ title: `${pendingCount} member${pendingCount === 1 ? " has" : "s have"} pending deposits`, sub: `${formatLakh(pendingTotal)} total outstanding` });
  }
  for (const c of runningChits) {
    alerts.push({ title: `${c.vendor.name} installment due soon`, sub: `${formatPaise(c.marginInstallment)} · monthly chit` });
  }

  return {
    approvals,
    alerts,
    events,
    summary: [
      { label: "Approvals", v: String(approvals.length), color: "bg-out" },
      { label: "Alerts", v: String(alerts.length), color: "bg-wfg" },
      { label: "Activity today", v: String(events.length), color: "bg-teal" },
    ],
  };
}
