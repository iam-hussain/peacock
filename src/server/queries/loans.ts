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

/** Signed principal changes on a loan, oldest first (+ tranche, − repay). Reversed disbursals /
 *  repayments (and their reversal entries) are dropped so an edited loan isn't double-counted. */
export async function loanEvents(loanId: string): Promise<{ at: Date; delta: bigint }[]> {
  const reversed = await prisma.transaction.findMany({
    where: { loanId, type: "REVERSAL", reversesId: { not: null } },
    select: { reversesId: true },
  });
  const reversedIds = reversed.map((r) => r.reversesId!).filter(Boolean);
  const txns = await prisma.transaction.findMany({
    where: { loanId, type: { in: ["LOAN_TAKEN", "LOAN_REPAY"] }, id: { notIn: reversedIds } },
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
  avatar: string | null;
  status: LoanStatusKey;
  statusLabel: string;
  badge: Status;
  memberClosed: boolean; // borrower's membership is CLOSED (left the club) — hidden by default on /loans
  pendingInterest: boolean; // active/overdue loan, or a closed loan that still owes interest (the "Pending" view)
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
  interestEarned?: string; // total accrued interest across every tranche of this loan
  interestCurrent?: string; // open loans only: interest on the current (open) tranche
  interestDue?: string;
  interestUnpaid?: boolean; // closed loan whose interest is still (partly) unpaid → highlight
  interestOverpaid?: string; // member paid MORE interest than accrued (e.g. rounded up on exit) → credit
}

async function loanRows() {
  return prisma.loan.findMany({
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    select: {
      id: true, requestedAmount: true, principalOutstanding: true, monthlyRateBps: true, startedAt: true, closedAt: true, status: true,
      membership: { select: { id: true, status: true, member: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
    },
  });
}

// interest = Σ per-cycle accrual across every balance segment of the loan's life.
// interestOwed (closed loans only) = still-unpaid loan interest for the borrower; >0 → highlight.
function toDTO(l: Awaited<ReturnType<typeof loanRows>>[number], tranches: number, interest: bigint, currentInterest: bigint, interestOwed: bigint, pendingInterest: boolean, overpaid: bigint): LoanDTO {
  const overpaidLabel = overpaid > 0n ? formatPaise(overpaid) : undefined;
  const name = [l.membership.member.firstName, l.membership.member.lastName].filter(Boolean).join(" ");
  const memberId = l.membership.member.id;
  const avatar = l.membership.member.avatarUrl;
  const memberClosed = l.membership.status === "CLOSED";
  const asOf = l.closedAt ?? new Date();
  const days = daysBetween(l.startedAt, asOf);
  const overdue = l.status === "ACTIVE" && days > TERM_DAYS;
  const key: LoanStatusKey = l.status === "CLOSED" ? "closed" : overdue ? "overdue" : "active";
  if (key === "closed") {
    return {
      id: l.id, memberId, member: name, avatar, status: key, statusLabel: "Closed", badge: "settled", memberClosed, pendingInterest, amount: formatLakh(l.requestedAmount), open: false,
      closedDate: monthYear(l.closedAt ?? l.startedAt), ran: `ran ${monthsDays(days)}`,
      interestEarned: formatLakh(interest),
      interestDue: interestOwed > 0n ? formatPaise(interestOwed) : undefined,
      interestUnpaid: interestOwed > 0n,
      interestOverpaid: overpaidLabel,
    };
  }
  const pct = Math.min(100, Math.round((days * 100) / TERM_DAYS)); // term elapsed
  return {
    id: l.id, memberId, member: name, avatar, status: key, statusLabel: overdue ? "Overdue" : "Active", badge: overdue ? "left" : "active", memberClosed, pendingInterest,
    amount: formatLakh(l.requestedAmount), open: true, start: monthYear(l.startedAt),
    elapsed: monthsDays(days), overdue,
    pct, pending: formatLakh(l.principalOutstanding),
    interest: formatPaise(interest),
    interestEarned: formatLakh(interest),
    interestCurrent: tranches > 1 ? formatLakh(currentInterest) : undefined,
    rate: rateLabel(l.monthlyRateBps), tranches,
    interestOverpaid: overpaidLabel,
  };
}

export async function getLoans(): Promise<LoanDTO[]> {
  const rows = await loanRows();
  const now = new Date();
  // Per-loan accrued interest + tranche count.
  const computed = await Promise.all(
    rows.map(async (l) => {
      const events = await loanEvents(l.id);
      const cycles = reconstructCycles(events, l.monthlyRateBps, now);
      const interest = cycles.reduce((s, c) => s + c.interest, 0n);
      const currentInterest = cycles.find((c) => c.open)?.interest ?? 0n;
      const tranches = events.filter((e) => e.delta > 0n).length;
      return { l, interest, currentInterest, tranches };
    }),
  );

  // Loan interest is collected per membership (LOAN_INTEREST carries no loanId), so track the
  // borrower's total accrued vs paid. A CLOSED loan whose borrower still owes interest — and has
  // no ACTIVE loan (whose interest is expected to keep accruing) — is flagged as unpaid.
  const accruedByMs = new Map<string, bigint>();
  const hasActiveByMs = new Set<string>();
  for (const { l, interest } of computed) {
    accruedByMs.set(l.membership.id, (accruedByMs.get(l.membership.id) ?? 0n) + interest);
    if (l.status === "ACTIVE") hasActiveByMs.add(l.membership.id);
  }
  const interestTxns = await prisma.transaction.findMany({
    where: { type: "LOAN_INTEREST" },
    select: { membershipId: true, entries: { where: { amount: { gt: 0 } }, select: { amount: true } } },
  });
  const paidByMs = new Map<string, bigint>();
  for (const t of interestTxns) {
    if (!t.membershipId) continue;
    const amt = t.entries.reduce((s, e) => s + e.amount, 0n);
    paidByMs.set(t.membershipId, (paidByMs.get(t.membershipId) ?? 0n) + amt);
  }

  // Owed interest is a per-member total, so pin it to the member's MOST RECENT closed loan only
  // (rows are ordered newest-closed-first), not repeated across every past closed loan.
  const anchored = new Set<string>();
  const overAnchored = new Set<string>();
  return computed.map(({ l, interest, currentInterest, tranches }) => {
    const ms = l.membership.id;
    const owed = (accruedByMs.get(ms) ?? 0n) - (paidByMs.get(ms) ?? 0n);
    let unpaidOwed = 0n;
    if (l.status === "CLOSED" && !hasActiveByMs.has(ms) && owed > 0n && !anchored.has(ms)) {
      unpaidOwed = owed;
      anchored.add(ms);
    }
    // Member paid more interest than accrued (a credit — e.g. rounded up on exit). Pin the excess to
    // one representative row (rows are ACTIVE-first then newest-closed, so this is their live loan or
    // most recent closed one). No member overpays today; this surfaces it if one ever does.
    let overpaid = 0n;
    if (owed < 0n && !overAnchored.has(ms)) {
      overpaid = -owed;
      overAnchored.add(ms);
    }
    // "Pending" = active/overdue loans + closed loans that still owe interest (member-status agnostic;
    // the Closed-members toggle filters closed members uniformly across every view).
    const pendingInterest = l.status === "ACTIVE" || unpaidOwed > 0n;
    return toDTO(l, tranches, interest, currentInterest, unpaidOwed, pendingInterest, overpaid);
  });
}

// Total loan interest still to collect = Σ over borrowers of (accrued to date − already paid),
// floored at 0 per member (an overpaid member is a credit, not something to collect). Interest is
// tracked per membership (LOAN_INTEREST carries no loanId), so aggregate accrual + payments by member.
export async function interestOwedTotal(): Promise<bigint> {
  const loans = await prisma.loan.findMany({ select: { id: true, monthlyRateBps: true, membershipId: true } });
  const now = new Date();
  // per-loan accrual first (concurrent), THEN fold into the map sequentially — avoids lost updates.
  const perLoan = await Promise.all(
    loans.map(async (l) => ({
      membershipId: l.membershipId,
      interest: reconstructCycles(await loanEvents(l.id), l.monthlyRateBps, now).reduce((s, c) => s + c.interest, 0n),
    })),
  );
  const accruedByMs = new Map<string, bigint>();
  for (const p of perLoan) accruedByMs.set(p.membershipId, (accruedByMs.get(p.membershipId) ?? 0n) + p.interest);
  const paidByMs = new Map<string, bigint>();
  for (const t of await prisma.transaction.findMany({ where: { type: "LOAN_INTEREST" }, select: { membershipId: true, entries: { where: { amount: { gt: 0 } }, select: { amount: true } } } })) {
    if (!t.membershipId) continue;
    paidByMs.set(t.membershipId, (paidByMs.get(t.membershipId) ?? 0n) + t.entries.reduce((s, e) => s + e.amount, 0n));
  }
  let total = 0n;
  for (const [ms, accrued] of accruedByMs) {
    const owed = accrued - (paidByMs.get(ms) ?? 0n);
    if (owed > 0n) total += owed;
  }
  return total;
}

export async function getLoanStats(): Promise<{ label: string; value: string; sub: string; tone?: "warn" | "out" | "in"; count?: string }[]> {
  const active = await prisma.loan.findMany({ where: { status: "ACTIVE" }, select: { principalOutstanding: true, monthlyRateBps: true, startedAt: true } });
  const onLoan = active.reduce((s, l) => s + l.principalOutstanding, 0n);
  const interestDue = await interestOwedTotal();
  const overdue = active.filter((l) => daysBetween(l.startedAt, new Date()) > TERM_DAYS);
  const overdueSum = overdue.reduce((s, l) => s + l.principalOutstanding, 0n);
  const collected = await prisma.ledgerAccount.aggregate({ _sum: { balance: true }, where: { kind: "INTEREST_INCOME" } });
  return [
    { label: "On loan now", value: formatLakh(onLoan), sub: "active + overdue" },
    { label: "Interest due", value: formatLakh(interestDue), sub: "to collect", tone: "warn" },
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

