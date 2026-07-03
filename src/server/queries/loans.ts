import "server-only";
import { prisma } from "@/server/db";
import { formatLakh, formatPaise } from "@/lib/money";
import { monthYear, daysBetween, monthsDays } from "@/lib/date";
import type { Status } from "@/components/shared/status-badge";

const TERM_DAYS = 150; // 5-month term
const rateLabel = (bps: number) => `${bps / 100}% / mo`;
const interestOf = (principal: bigint, bps: number) => (principal * BigInt(bps)) / 10000n;

// ponytail: single-segment accrual on the current outstanding — exact per-tranche
// accrual (restart on each principal change) needs the deferred interest engine (§14).
// PRODUCT.md §9: full calendar months at the monthly rate + leftover days pro-rated by
// the number of days in that incomplete month.
export function accruedInterest(principal: bigint, bps: number, start: Date, asOf: Date): bigint {
  if (principal <= 0n || asOf <= start) return 0n;
  const monthly = interestOf(principal, bps);
  const anniv = new Date(start);
  let months = 0;
  for (;;) {
    const next = new Date(anniv);
    next.setUTCMonth(next.getUTCMonth() + 1);
    if (next > asOf) break;
    anniv.setUTCMonth(anniv.getUTCMonth() + 1);
    months++;
  }
  let total = monthly * BigInt(months);
  const leftover = daysBetween(anniv, asOf);
  if (leftover > 0) {
    const dim = new Date(Date.UTC(anniv.getUTCFullYear(), anniv.getUTCMonth() + 1, 0)).getUTCDate();
    total += (monthly * BigInt(leftover)) / BigInt(dim);
  }
  return total;
}

/** A period where the outstanding balance stayed fixed (PRODUCT.md §9). Any
 * tranche/top-up or repay ends one cycle and opens the next at the new balance;
 * a full repay (balance → 0) closes the loan with no new cycle. Interest accrues
 * per cycle on its own fixed balance over its own span. */
export interface LoanCycle {
  start: Date;
  end: Date;
  balance: bigint;
  interest: bigint;
  open: boolean;
}

/** Signed principal changes on a loan, oldest first (+ tranche, − repay). */
export async function loanEvents(loanId: string): Promise<{ at: Date; delta: bigint }[]> {
  const txns = await prisma.transaction.findMany({
    where: { loanId, type: { in: ["LOAN_TAKEN", "LOAN_REPAY"] } },
    orderBy: { occurredAt: "asc" },
    select: { occurredAt: true, entries: { where: { account: { kind: "LOAN_RECEIVABLE" } }, select: { amount: true } } },
  });
  return txns.map((t) => ({ at: t.occurredAt, delta: t.entries.reduce((s, e) => s + e.amount, 0n) }));
}

/** Replay the principal changes into cycles; the trailing open cycle runs to `asOf`. */
export function reconstructCycles(events: { at: Date; delta: bigint }[], bps: number, asOf: Date): LoanCycle[] {
  const cycles: LoanCycle[] = [];
  let balance = 0n;
  let start: Date | null = null;
  for (const ev of events) {
    if (balance > 0n && start) cycles.push({ start, end: ev.at, balance, interest: accruedInterest(balance, bps, start, ev.at), open: false });
    balance += ev.delta;
    start = ev.at;
  }
  if (balance > 0n && start) cycles.push({ start, end: asOf, balance, interest: accruedInterest(balance, bps, start, asOf), open: true });
  return cycles;
}

export type LoanStatusKey = "active" | "overdue" | "closed";

export interface LoanDTO {
  id: string;
  memberId: string;
  member: string;
  status: LoanStatusKey;
  statusLabel: string;
  badge: Status;
  amount: string;
  open: boolean;
  start?: string;
  elapsed?: string;
  overdue?: boolean;
  pct?: number;
  pending?: string;
  interest?: string;
  rate?: string;
  tranches?: number;
  closedDate?: string;
  ran?: string;
  interestEarned?: string;
  interestDue?: string;
}

async function loanRows() {
  return prisma.loan.findMany({
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    select: {
      id: true, requestedAmount: true, principalOutstanding: true, monthlyRateBps: true, startedAt: true, closedAt: true, status: true,
      membership: { select: { member: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });
}

// interest = Σ per-cycle accrual across every balance segment of the loan's life.
function toDTO(l: Awaited<ReturnType<typeof loanRows>>[number], tranches: number, interest: bigint): LoanDTO {
  const name = [l.membership.member.firstName, l.membership.member.lastName].filter(Boolean).join(" ");
  const memberId = l.membership.member.id;
  const asOf = l.closedAt ?? new Date();
  const days = daysBetween(l.startedAt, asOf);
  const overdue = l.status === "ACTIVE" && days > TERM_DAYS;
  const key: LoanStatusKey = l.status === "CLOSED" ? "closed" : overdue ? "overdue" : "active";
  if (key === "closed") {
    return {
      id: l.id, memberId, member: name, status: key, statusLabel: "Closed", badge: "settled", amount: formatLakh(l.requestedAmount), open: false,
      closedDate: monthYear(l.closedAt ?? l.startedAt), ran: `ran ${monthsDays(days)}`,
      interestEarned: formatLakh(interest),
    };
  }
  const pct = Math.min(100, Math.round((days * 100) / TERM_DAYS)); // term elapsed
  return {
    id: l.id, memberId, member: name, status: key, statusLabel: overdue ? "Overdue" : "Active", badge: overdue ? "left" : "active",
    amount: formatLakh(l.requestedAmount), open: true, start: monthYear(l.startedAt),
    elapsed: monthsDays(days), overdue,
    pct, pending: formatLakh(l.principalOutstanding),
    interest: formatPaise(interest),
    rate: rateLabel(l.monthlyRateBps), tranches,
  };
}

export async function getLoans(): Promise<LoanDTO[]> {
  const rows = await loanRows();
  const now = new Date();
  return Promise.all(
    rows.map(async (l) => {
      const events = await loanEvents(l.id);
      const cycles = reconstructCycles(events, l.monthlyRateBps, now);
      const interest = cycles.reduce((s, c) => s + c.interest, 0n);
      const tranches = events.filter((e) => e.delta > 0n).length;
      return toDTO(l, tranches, interest);
    }),
  );
}

export async function getLoanStats(): Promise<{ label: string; value: string; sub: string; tone?: "warn" | "out" | "in"; count?: string }[]> {
  const active = await prisma.loan.findMany({ where: { status: "ACTIVE" }, select: { principalOutstanding: true, monthlyRateBps: true, startedAt: true } });
  const onLoan = active.reduce((s, l) => s + l.principalOutstanding, 0n);
  const interestDue = active.reduce((s, l) => s + interestOf(l.principalOutstanding, l.monthlyRateBps), 0n);
  const overdue = active.filter((l) => daysBetween(l.startedAt, new Date()) > TERM_DAYS);
  const overdueSum = overdue.reduce((s, l) => s + l.principalOutstanding, 0n);
  const collected = await prisma.ledgerAccount.aggregate({ _sum: { balance: true }, where: { kind: "INTEREST_INCOME" } });
  return [
    { label: "On loan now", value: formatLakh(onLoan), sub: "active + overdue" },
    { label: "Interest due", value: formatPaise(interestDue), sub: "to collect", tone: "warn" },
    { label: "Overdue", value: formatLakh(overdueSum), sub: `${overdue.length} loan${overdue.length === 1 ? "" : "s"}`, count: `${overdue.length} loan${overdue.length === 1 ? "" : "s"}`, tone: "out" },
    { label: "Interest earned", value: formatLakh(-(collected._sum.balance ?? 0n)), sub: "collected to date", tone: "in" },
  ];
}

export async function getCurrentRate(): Promise<string> {
  const cfg = await prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { rateSchedule: true } });
  const sched = (cfg?.rateSchedule as { rateBps: number }[] | undefined) ?? [];
  const bps = sched.length ? sched[sched.length - 1].rateBps : 100;
  return rateLabel(bps);
}

