import "server-only";
import { prisma } from "@/server/db";
import { formatLakh, formatPaise, roundToWholeRupee } from "@/lib/money";
import { monthYear, dayMonthYear, daysBetween, monthsDays, ist, addMonths } from "@/lib/date";
import type { Status } from "@/components/shared/status-badge";

const rateLabel = (bps: number) => `${bps / 100}% / mo`;
const interestOf = (principal: bigint, bps: number) => (principal * BigInt(bps)) / 10000n;

// The loan knobs that drive term / overdue / penalty / interest era (all admin-configurable, §5/§8).
export interface LoanCfg {
  loanTermMonths: number;
  loanCooldownMonths: number;
  overduePenaltyBps: number;
  dayInterestFrom: Date;
}
const DEFAULT_CFG: LoanCfg = { loanTermMonths: 5, loanCooldownMonths: 1, overduePenaltyBps: 0, dayInterestFrom: new Date(0) };

export async function loanConfig(): Promise<LoanCfg> {
  const cfg = await prisma.clubConfig.findUnique({
    where: { id: "singleton" },
    select: { loanTermMonths: true, loanCooldownMonths: true, overduePenaltyBps: true, dayInterestFrom: true },
  });
  return cfg ? { ...cfg } : DEFAULT_CFG;
}

// PRODUCT.md §9: full calendar months at the monthly rate + leftover days pro-rated by the number of
// days in that incomplete month. All month/day anchoring is on the IST wall-clock (§11). Before
// `dayInterestFrom` interest was whole-months-only (a part-month rounds UP); daily from then on.
export function accruedInterest(principal: bigint, bps: number, start: Date, asOf: Date, dayInterestFrom: Date): bigint {
  if (principal <= 0n || asOf <= start || bps <= 0) return 0n;
  const monthly = interestOf(principal, bps);
  const end = ist(asOf);
  const anniv = ist(start);
  let months = 0;
  for (;;) {
    const next = new Date(anniv);
    next.setUTCMonth(next.getUTCMonth() + 1);
    if (next > end) break;
    anniv.setUTCMonth(anniv.getUTCMonth() + 1);
    months++;
  }
  let total = monthly * BigInt(months);
  const leftover = daysBetween(anniv, end);
  if (leftover > 0) {
    if (anniv < ist(dayInterestFrom)) {
      total += monthly; // whole-month era: any part-month rounds up to a full month
    } else {
      const dim = new Date(Date.UTC(anniv.getUTCFullYear(), anniv.getUTCMonth() + 1, 0)).getUTCDate();
      total += (monthly * BigInt(leftover)) / BigInt(dim);
    }
  }
  return total;
}

/** Extra interest on an overdue loan: `overduePenaltyBps` per month on the outstanding balance,
 * accruing from the term-end date to `asOf` (§5/§13). Uses CURRENT config so switching the knob on
 * applies to every overdue loan instantly. Zero unless past term and the penalty is enabled. */
export function overduePenalty(outstanding: bigint, startedAt: Date, cfg: LoanCfg, asOf: Date): bigint {
  if (cfg.overduePenaltyBps <= 0 || outstanding <= 0n) return 0n;
  const termEnd = addMonths(startedAt, cfg.loanTermMonths);
  if (asOf <= termEnd) return 0n;
  return accruedInterest(outstanding, cfg.overduePenaltyBps, termEnd, asOf, cfg.dayInterestFrom);
}

/** A loan is overdue once `asOf` passes its `loanTermMonths` calendar-month term (§8). */
export function isOverdue(startedAt: Date, cfg: LoanCfg, asOf: Date): boolean {
  return asOf > addMonths(startedAt, cfg.loanTermMonths);
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
export function reconstructCycles(events: { at: Date; delta: bigint }[], bps: number, asOf: Date, dayInterestFrom: Date): LoanCycle[] {
  const cycles: LoanCycle[] = [];
  let balance = 0n;
  let start: Date | null = null;
  for (const ev of events) {
    if (balance > 0n && start) cycles.push({ start, end: ev.at, balance, interest: accruedInterest(balance, bps, start, ev.at, dayInterestFrom), open: false });
    balance += ev.delta;
    start = ev.at;
  }
  if (balance > 0n && start) cycles.push({ start, end: asOf, balance, interest: accruedInterest(balance, bps, start, asOf, dayInterestFrom), open: true });
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
function toDTO(l: Awaited<ReturnType<typeof loanRows>>[number], cfg: LoanCfg, tranches: number, interest: bigint, currentInterest: bigint, interestOwed: bigint, pendingInterest: boolean, overpaid: bigint): LoanDTO {
  const overpaidLabel = overpaid > 0n ? formatPaise(overpaid) : undefined;
  const name = [l.membership.member.firstName, l.membership.member.lastName].filter(Boolean).join(" ");
  const memberId = l.membership.member.id;
  const avatar = l.membership.member.avatarUrl;
  const memberClosed = l.membership.status === "CLOSED";
  const asOf = l.closedAt ?? new Date();
  const days = daysBetween(l.startedAt, asOf);
  const termDays = daysBetween(l.startedAt, addMonths(l.startedAt, cfg.loanTermMonths)) || 1;
  const overdue = l.status === "ACTIVE" && isOverdue(l.startedAt, cfg, asOf);
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
  const pct = Math.min(100, Math.round((days * 100) / termDays)); // term elapsed
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
  const cfg = await loanConfig();
  // Per-loan accrued interest (whole rupees, incl. overdue penalty) + tranche count.
  const computed = await Promise.all(
    rows.map(async (l) => {
      const events = await loanEvents(l.id);
      const cycles = reconstructCycles(events, l.monthlyRateBps, now, cfg.dayInterestFrom);
      const penalty = l.status === "ACTIVE" ? overduePenalty(l.principalOutstanding, l.startedAt, cfg, now) : 0n;
      const interest = roundToWholeRupee(cycles.reduce((s, c) => s + c.interest, 0n) + penalty);
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
    return toDTO(l, cfg, tranches, interest, currentInterest, unpaidOwed, pendingInterest, overpaid);
  });
}

// Total loan interest still to collect = Σ over borrowers of (accrued to date − already paid),
// floored at 0 per member (an overpaid member is a credit, not something to collect). Interest is
// tracked per membership (LOAN_INTEREST carries no loanId), so aggregate accrual + payments by member.
/** Per-membership interest still to collect (accrued − paid, whole rupees, floored at 0 per member). */
export async function interestOwedByMembership(): Promise<Map<string, bigint>> {
  const loans = await prisma.loan.findMany({ select: { id: true, monthlyRateBps: true, membershipId: true, principalOutstanding: true, startedAt: true, status: true } });
  const now = new Date();
  const cfg = await loanConfig();
  // per-loan accrual first (concurrent), THEN fold into the map sequentially — avoids lost updates.
  const perLoan = await Promise.all(
    loans.map(async (l) => {
      const cycleInterest = reconstructCycles(await loanEvents(l.id), l.monthlyRateBps, now, cfg.dayInterestFrom).reduce((s, c) => s + c.interest, 0n);
      const penalty = l.status === "ACTIVE" ? overduePenalty(l.principalOutstanding, l.startedAt, cfg, now) : 0n;
      return { membershipId: l.membershipId, interest: roundToWholeRupee(cycleInterest + penalty) };
    }),
  );
  const accruedByMs = new Map<string, bigint>();
  for (const p of perLoan) accruedByMs.set(p.membershipId, (accruedByMs.get(p.membershipId) ?? 0n) + p.interest);
  const paidByMs = new Map<string, bigint>();
  for (const t of await prisma.transaction.findMany({ where: { type: "LOAN_INTEREST" }, select: { membershipId: true, entries: { where: { amount: { gt: 0 } }, select: { amount: true } } } })) {
    if (!t.membershipId) continue;
    paidByMs.set(t.membershipId, (paidByMs.get(t.membershipId) ?? 0n) + t.entries.reduce((s, e) => s + e.amount, 0n));
  }
  const owed = new Map<string, bigint>();
  for (const [ms, accrued] of accruedByMs) {
    const o = accrued - (paidByMs.get(ms) ?? 0n);
    if (o > 0n) owed.set(ms, o);
  }
  return owed;
}

// Total loan interest still to collect across all borrowers.
export async function interestOwedTotal(): Promise<bigint> {
  let total = 0n;
  for (const v of (await interestOwedByMembership()).values()) total += v;
  return total;
}

export async function getLoanStats(): Promise<{ label: string; value: string; sub: string; tone?: "warn" | "out" | "in"; count?: string }[]> {
  const active = await prisma.loan.findMany({ where: { status: "ACTIVE" }, select: { principalOutstanding: true, monthlyRateBps: true, startedAt: true } });
  const cfg = await loanConfig();
  const now = new Date();
  const onLoan = active.reduce((s, l) => s + l.principalOutstanding, 0n);
  const interestDue = await interestOwedTotal();
  const overdue = active.filter((l) => isOverdue(l.startedAt, cfg, now));
  const overdueSum = overdue.reduce((s, l) => s + l.principalOutstanding, 0n);
  const collected = await prisma.ledgerAccount.aggregate({ _sum: { balance: true }, where: { kind: "INTEREST_INCOME" } });
  return [
    { label: "On loan now", value: formatLakh(onLoan), sub: "active + overdue" },
    { label: "Interest due", value: formatLakh(interestDue), sub: "to collect", tone: "warn" },
    { label: "Overdue", value: formatLakh(overdueSum), sub: `${overdue.length} loan${overdue.length === 1 ? "" : "s"}`, count: `${overdue.length} loan${overdue.length === 1 ? "" : "s"}`, tone: "out" },
    { label: "Interest earned", value: formatLakh(-(collected._sum.balance ?? 0n)), sub: "collected to date", tone: "in" },
  ];
}

// ---------------- next-loan eligibility & priority (PRODUCT.md §8) ----------------
export type LoanPriority = "High" | "Medium" | "Low";
export interface LoanEligibilityDTO {
  memberId: string;
  member: string;
  avatar: string | null;
  eligible: boolean; // true = can start a NEW loan right now
  reason: string; // "Ready to borrow" / "Has an active loan" / "Cooldown until …"
  hasActiveLoan: boolean; // a "Give a loan" here attaches as a tranche, not a fresh loan
  priority: LoanPriority; // hint only — the admin decides who actually borrows
  priorityRank: number; // 3 High · 2 Medium · 1 Low (for sorting)
  loanCount: number; // lifetime loans taken
}

// Priority is advice (§8): the less a member borrows, the higher their priority for the next loan.
function priorityFor(loanCount: number): { priority: LoanPriority; rank: number } {
  if (loanCount <= 1) return { priority: "High", rank: 3 };
  if (loanCount <= 3) return { priority: "Medium", rank: 2 };
  return { priority: "Low", rank: 1 };
}

/** Every active member with their next-loan eligibility + priority hint, eligible & highest
 * priority first. Drives the /loans eligibility panel and the Give-a-loan picker. */
export async function getLoanEligibility(): Promise<LoanEligibilityDTO[]> {
  const cfg = await loanConfig();
  const now = new Date();
  const memberships = await prisma.membership.findMany({
    where: { status: "ACTIVE" },
    select: {
      member: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      loans: { select: { status: true, closedAt: true } },
    },
  });
  return memberships
    .map((m) => {
      const member = [m.member.firstName, m.member.lastName].filter(Boolean).join(" ");
      const loanCount = m.loans.length;
      const hasActiveLoan = m.loans.some((l) => l.status === "ACTIVE");
      const lastClosed = m.loans
        .filter((l) => l.status === "CLOSED" && l.closedAt)
        .map((l) => l.closedAt!)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const cooldownEnd = lastClosed && cfg.loanCooldownMonths > 0 ? addMonths(lastClosed, cfg.loanCooldownMonths) : null;
      const inCooldown = cooldownEnd ? now < cooldownEnd : false;

      let eligible = true;
      let reason = "Ready to borrow";
      if (hasActiveLoan) { eligible = false; reason = "Has an active loan"; }
      else if (inCooldown && cooldownEnd) { eligible = false; reason = `Cooldown until ${dayMonthYear(cooldownEnd)}`; }

      const { priority, rank } = priorityFor(loanCount);
      return { memberId: m.member.id, member, avatar: m.member.avatarUrl, eligible, reason, hasActiveLoan, priority, priorityRank: rank, loanCount };
    })
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.priorityRank - a.priorityRank || a.member.localeCompare(b.member));
}

export async function getCurrentRate(): Promise<string> {
  const cfg = await prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { rateSchedule: true } });
  const sched = (cfg?.rateSchedule as { rateBps: number }[] | undefined) ?? [];
  const bps = sched.length ? sched[sched.length - 1].rateBps : 100;
  return rateLabel(bps);
}

