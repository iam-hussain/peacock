import "server-only";
import { prisma } from "@/server/db";
import { formatPaise, formatLakh } from "@/lib/money";
import { daysBetween } from "@/lib/date";
import { getTransactions } from "./transactions";

export interface NotificationsData {
  approvals: { id: string; who: string; type: string; sub: string; amt: string; dir: string; creator: string; treasurer: string; method: string; txn: string; created: string }[];
  alerts: { title: string; sub: string }[];
  events: { title: string; sub: string; time: string; amt: string; dir: string }[];
  summary: { label: string; v: string; color: string }[];
}

/** Bell badge count = what the notifications page surfaces as needing attention. */
export async function getUnreadCount(): Promise<number> {
  const { approvals, alerts } = await getNotifications();
  return approvals.length + alerts.length;
}

export async function getNotifications(): Promise<NotificationsData> {
  // Approvals ← pending submissions (none yet in a fresh import → empty list).
  const subs = await prisma.submission.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" } });
  const approvals = subs.map((s) => {
    const p = s.payload as Record<string, string>;
    return {
      id: s.id, who: p.party ?? "—", type: s.intent, sub: "awaiting your approval", amt: p.amount ?? "", dir: "in",
      creator: p.party ?? "—", treasurer: p.treasurer ?? "—", method: p.method ?? "Cash", txn: p.date ?? "", created: "",
    };
  });

  // Alerts ← derived live from current state (overdue loans, pending deposits, chit due).
  const alerts: { title: string; sub: string }[] = [];
  const overdue = await prisma.loan.findMany({ where: { status: "ACTIVE" }, select: { principalOutstanding: true, startedAt: true, membership: { select: { member: { select: { firstName: true, lastName: true } } } } } });
  for (const l of overdue) {
    const days = daysBetween(l.startedAt, new Date());
    if (days > 150) {
      const name = [l.membership.member.firstName, l.membership.member.lastName].filter(Boolean).join(" ");
      alerts.push({ title: `${name}'s loan is overdue by ${days - 150} days`, sub: `${formatPaise(l.principalOutstanding)} principal pending · interest still accruing` });
    }
  }
  const charges = await prisma.charge.groupBy({ by: ["membershipId"], where: { kind: "CATCHUP" }, _sum: { amount: true } });
  if (charges.length) {
    const total = charges.reduce((s, c) => s + (c._sum.amount ?? 0n), 0n);
    alerts.push({ title: `${charges.length} members have pending deposits`, sub: `${formatLakh(total)} total outstanding` });
  }
  const runningChits = await prisma.chitFund.findMany({ where: { status: "RUNNING" }, select: { marginInstallment: true, durationMonths: true, vendor: { select: { name: true } } } });
  for (const c of runningChits.slice(0, 1)) {
    alerts.push({ title: `${c.vendor.name} installment due soon`, sub: `${formatPaise(c.marginInstallment)} · monthly chit` });
  }

  // Events ← recent ledger activity.
  const recent = await getTransactions(6);
  const events = recent.map((r) => ({
    title: `${r.what} · ${r.dir === "out" ? r.to.name : r.from.name}`,
    sub: `by ${r.dir === "out" ? r.from.name : r.to.name}`,
    time: r.entered,
    amt: r.amount,
    dir: r.dir,
  }));

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
