import "server-only";
import { prisma } from "@/server/db";
import { formatLakh, formatPaise, profitShare } from "@/lib/money";
import { monthYear, monthsDays, tenure, daysBetween, dayMonthYear } from "@/lib/date";
import { loanEvents, reconstructCycles, loanConfig, isOverdue, interestOwedTotal } from "./loans";
import { vendorProfitAndObligation } from "./vendors";
import { getCashHolderOptions } from "./entries";
import type { Status } from "@/components/shared/status-badge";

export interface MemberDTO {
  id: string;
  name: string;
  avatarUrl: string | null;
  joined: string;
  deposits: string;
  profit: string;
  value: string;
  held: string | null;
  adjustment: string | null; // catch-up + penalty STILL OUTSTANDING, combined
  adjustmentCharged: string | null; // catch-up + penalty EVER charged (shown even once fully paid)
  sort?: MemberSort; // raw numeric keys for client-side column sorting (list rows only)
  pending: string | null;
  status: Status;
}

/** Raw values behind the formatted list cells, so the table can sort numerically (not by "₹3L" text). */
export interface MemberSort {
  name: string;
  deposits: number;
  profit: number;
  value: number;
  held: number;
  adjustment: number; // sorts by total ever charged (the value the column shows)
  pending: number;
  status: number; // active first (0), then inactive (1), then left (2)
}

// Sum of a charge kind still outstanding for a membership (raised − paid down).
// Pay-downs credit MEMBER_EQUITY / OTHER_INCOME with a NEGATIVE leg (−A), so the paid
// magnitude is −sum; outstanding = raised + sum(paid legs).
async function outstandingCharge(membershipId: string, kind: "CATCHUP" | "PENALTY"): Promise<bigint> {
  const raised = await prisma.charge.aggregate({ _sum: { amount: true }, where: { membershipId, kind } });
  const paid = await prisma.entry.aggregate({
    _sum: { amount: true },
    where: { transaction: { membershipId, type: kind }, account: { kind: kind === "CATCHUP" ? "MEMBER_EQUITY" : "OTHER_INCOME" } },
  });
  return (raised._sum.amount ?? 0n) + (paid._sum.amount ?? 0n);
}

export type Stage = { amountPaise: number; startDate: string };

const monthIdx = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();

// Expected deposit total from the club's deposit start (earliest stage) through the current
// month, per the stage schedule. This is the FULL-club-life baseline — the same for every
// active member regardless of join date (PRODUCT.md §6); paid counts deposits + catch-up.
export function expectedClubDeposit(stages: Stage[], now = new Date()): bigint {
  if (!stages.length) return 0n;
  const bands = stages
    .map((s) => ({ from: monthIdx(new Date(s.startDate)), amt: BigInt(s.amountPaise) }))
    .sort((a, b) => a.from - b.from);
  let total = 0n;
  for (let m = bands[0].from; m <= monthIdx(now); m++) {
    let amt = 0n;
    for (const b of bands) if (b.from <= m) amt = b.amt;
    total += amt;
  }
  return total;
}

function memberStatus(active: boolean, archivedAt: Date | null): Status {
  return active ? "active" : archivedAt ? "left" : "inactive";
}

/** The member directory (list DTO), oldest members first. */
export async function getMembers(): Promise<MemberDTO[]> {
  const members = await prisma.member.findMany({
    orderBy: { customerSince: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      customerSince: true,
      archivedAt: true,
      treasury: { select: { balance: true } },
      memberships: { orderBy: { seq: "desc" }, select: { id: true, status: true, accounts: { where: { kind: "MEMBER_EQUITY" }, select: { id: true, balance: true } } } },
    },
  });

  // Full-club-life expected deposit baseline (club start → today) — same for every active member
  // (PRODUCT.md §6). "Pending" on the list = pending deposits (SCREENS.md), i.e. expected − paid.
  const cfg = await prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { stages: true } });
  const expectedDeposit = expectedClubDeposit((cfg?.stages as Stage[] | undefined) ?? []);

  // Per-member gross deposits (PERIODIC_DEPOSIT + CATCHUP credited to equity) and net value.
  const rows = await Promise.all(
    members.map(async (m) => {
      const active = m.memberships.some((s) => s.status === "ACTIVE");
      const equity = m.memberships.flatMap((s) => s.accounts)[0];
      const value = -(equity?.balance ?? 0n);
      const dep = equity
        ? await prisma.entry.aggregate({ _sum: { amount: true }, where: { accountId: equity.id, transaction: { type: { in: ["PERIODIC_DEPOSIT", "CATCHUP"] } } } })
        : { _sum: { amount: null } };
      const deposits = -(dep._sum.amount ?? 0n);
      const membershipId = m.memberships[0]?.id;
      const penalty = membershipId ? await outstandingCharge(membershipId, "PENALTY") : 0n;
      const catchup = membershipId ? await outstandingCharge(membershipId, "CATCHUP") : 0n;
      const adjustment = (penalty > 0n ? penalty : 0n) + (catchup > 0n ? catchup : 0n);
      const chargedAgg = membershipId
        ? await prisma.charge.aggregate({ _sum: { amount: true }, where: { membershipId, kind: { in: ["CATCHUP", "PENALTY"] } } })
        : { _sum: { amount: null } };
      const charged = chargedAgg._sum.amount ?? 0n;
      const pending = active && expectedDeposit > deposits ? expectedDeposit - deposits : 0n;
      return { m, active, value, deposits, pending, adjustment, charged };
    }),
  );

  // Profit isn't posted to member equity in this ledger — it pools in the club
  // (interest + vendor returns). Split it over the EXPECTED deposit base (active members ×
  // expected-per-member) so a fully-paid member always earns their full share regardless of others,
  // each underpayer bears their own shortfall, and the club never distributes more than it earned
  // (PRODUCT.md §11 — see `profitShare`).
  const clubProfit = await shareableClubProfit();
  const activeCount = rows.filter((r) => r.active).length;
  const shareOf = (deposits: bigint, active: boolean) =>
    active ? profitShare(clubProfit, deposits, activeCount, expectedDeposit) : 0n;

  return rows
    .map(({ m, active, value, deposits, pending, adjustment, charged }) => ({
      id: m.id,
      name: [m.firstName, m.lastName].filter(Boolean).join(" "),
      avatarUrl: m.avatarUrl,
      joined: monthYear(m.customerSince),
      deposits: formatPaise(deposits),
      profit: formatPaise(shareOf(deposits, active)),
      value: active ? formatPaise(value) : "—",
      held: m.treasury && m.treasury.balance !== 0n ? formatPaise(m.treasury.balance) : null,
      adjustment: adjustment > 0n ? formatPaise(adjustment) : null,
      adjustmentCharged: charged > 0n ? formatPaise(charged) : null,
      pending: pending > 0n ? formatPaise(pending) : null,
      status: memberStatus(active, m.archivedAt),
      sort: {
        name: [m.firstName, m.lastName].filter(Boolean).join(" "),
        deposits: Number(deposits),
        profit: Number(shareOf(deposits, active)),
        value: Number(value),
        held: Number(m.treasury?.balance ?? 0n),
        adjustment: Number(charged),
        pending: Number(pending),
        status: active ? 0 : m.archivedAt ? 2 : 1,
      },
    }))
    // Active members first, then alphabetical by name.
    .sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || a.name.localeCompare(b.name));
}

/** Shareable club profit = loan interest + other income + vendor P/L. Vendor P/L already nets chit
 *  obligations still owed and projects un-taken chit face value (PRODUCT.md §10/§11). */
export async function realizedClubProfit(): Promise<bigint> {
  const income = await prisma.ledgerAccount.aggregate({
    _sum: { balance: true },
    where: { kind: { in: ["INTEREST_INCOME", "OTHER_INCOME"] }, id: { not: "club-opening" } },
  });
  return -(income._sum.balance ?? 0n) + (await vendorProfitAndObligation()).profit; // credit accounts hold negative balances
}

/** Pooled profit that ACTIVE members share (PRODUCT.md §11):
 *    realized (net of chit obligation) + pending loan interest − profit already withdrawn by leavers.
 *  Pending interest counts because the club will collect it. The withdrawn term matters because a
 *  WITHDRAW only moves cash → the leaver's equity (intents.ts) — it never debits the income
 *  accounts, so a leaver's profit lingers inside `realizedClubProfit`. Without subtracting it, active
 *  members would be credited profit that has already left the club as cash, and the club would fall
 *  exactly that short if everyone settled at once. Mirrors the dashboard's `currentProfit`. */
export async function shareableClubProfit(): Promise<bigint> {
  return (await realizedClubProfit()) + (await interestOwedTotal()) - (await profitWithdrawnTotal());
}

/** Profit already paid out to members who left (§12). Settlement posts the profit leg as a
 *  PROFIT_WITHDRAW into the PROFIT_DISTRIBUTED contra-income account, so the total distributed is
 *  just that account's (debit, positive) balance — exact, no reconstruction from netted payouts. */
export async function profitWithdrawnTotal(): Promise<bigint> {
  const a = await prisma.ledgerAccount.aggregate({ _sum: { balance: true }, where: { kind: "PROFIT_DISTRIBUTED" } });
  return a._sum.balance ?? 0n;
}

/** Raw active-member fund aggregates for the dashboard (paise). Same deposit + pending
 * definition as getMembers (PRODUCT.md §6): pending = expected(club-life) − paid, floored. */
export async function getMemberFunds(): Promise<{
  activeMembers: number; activeDeposits: bigint; avgBalance: bigint; pendingTotal: bigint; pendingCount: number;
}> {
  const cfg = await prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { stages: true } });
  const expected = expectedClubDeposit((cfg?.stages as Stage[] | undefined) ?? []);
  const active = await prisma.membership.findMany({
    where: { status: "ACTIVE" },
    select: { accounts: { where: { kind: "MEMBER_EQUITY" }, select: { id: true, balance: true } } },
  });
  let activeDeposits = 0n, value = 0n, pendingTotal = 0n, pendingCount = 0;
  for (const ms of active) {
    const eq = ms.accounts[0];
    if (!eq) continue;
    const dep = await prisma.entry.aggregate({ _sum: { amount: true }, where: { accountId: eq.id, transaction: { type: { in: ["PERIODIC_DEPOSIT", "CATCHUP"] } } } });
    const deposits = -(dep._sum.amount ?? 0n);
    activeDeposits += deposits;
    value += -(eq.balance ?? 0n);
    if (expected > deposits) { pendingTotal += expected - deposits; pendingCount++; }
  }
  const n = active.length;
  return { activeMembers: n, activeDeposits, avgBalance: n ? value / BigInt(n) : 0n, pendingTotal, pendingCount };
}

/** Club-wide charge totals for a kind (paise): assigned (raised), collected (paid down), pending. */
export async function chargeTotals(kind: "CATCHUP" | "PENALTY"): Promise<{ assigned: bigint; collected: bigint; pending: bigint }> {
  const raised = await prisma.charge.aggregate({ _sum: { amount: true }, where: { kind } });
  const paid = await prisma.entry.aggregate({
    _sum: { amount: true },
    where: { transaction: { type: kind }, account: { kind: kind === "CATCHUP" ? "MEMBER_EQUITY" : "OTHER_INCOME" } },
  });
  const assigned = raised._sum.amount ?? 0n;
  const collected = -(paid._sum.amount ?? 0n); // pay-down legs are negative
  return { assigned, collected, pending: assigned - collected };
}

/** Headline for the members page, e.g. "11 members · 9 active". */
export async function getMemberSummary(): Promise<{ text: string; totalDeposits: string }> {
  const members = await prisma.member.findMany({ select: { memberships: { select: { status: true } } } });
  const total = members.length;
  const active = members.filter((m) => m.memberships.some((s) => s.status === "ACTIVE")).length;
  const dep = await prisma.entry.aggregate({ _sum: { amount: true }, where: { transaction: { type: "PERIODIC_DEPOSIT" }, account: { kind: "MEMBER_EQUITY" } } });
  return { text: `${total} members · ${active} active`, totalDeposits: formatLakh(-(dep._sum.amount ?? 0n)) };
}

export async function getMemberIds(): Promise<string[]> {
  const rows = await prisma.member.findMany({ select: { id: true } });
  return rows.map((r) => r.id);
}

// What a brand-new member is expected to bring in on joining (mirrors addMember, §6/§7): the
// full-club-life deposit baseline plus the first-join catch-up (average per-member profit).
export interface JoinPreviewDTO {
  deposits: string; // monthly deposits expected since club start
  profit: string; // catch-up = equal per-member profit share
  total: string;
}
export async function getJoinPreview(): Promise<JoinPreviewDTO> {
  const cfg = await prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { stages: true } });
  const deposits = expectedClubDeposit((cfg?.stages as Stage[] | undefined) ?? []);
  // shareableClubProfit ÷ active members — matches the dashboard "profit per member" and the
  // catch-up addMember actually raises, so the preview and the real charge agree.
  const [pooled, activeCount] = await Promise.all([shareableClubProfit(), prisma.membership.count({ where: { status: "ACTIVE" } })]);
  const profit = activeCount > 0 && pooled > 0n ? pooled / BigInt(activeCount) : 0n;
  return { deposits: formatPaise(deposits), profit: formatPaise(profit), total: formatPaise(deposits + profit) };
}

// ---------------- detail ----------------
export interface LoanCycleDTO {
  n: number;
  status: "closed" | "active" | "overdue";
  statusLabel: string;
  amt: string;
  start: string;
  end: string;
  rate: string;
  days: string;
  interest: string;
}

// Human labels for the Charge.reason string enum (see schema note).
const REASON_LABEL: Record<string, string> = {
  FIRST_TIME_JOIN: "First-time join",
  REJOIN: "Rejoin",
  PROFIT_GAP_TOPUP: "Profit-gap top-up",
  MID_TERM_EQUALISATION: "Mid-term equalisation",
  DELAYED_PAYMENT: "Delayed payment",
  LOAN_REPAYMENT_DELAY: "Loan-repayment delay",
  HOLDING_TOO_LONG: "Holding too long",
  MISSED_DEPOSIT: "Missed deposit",
  OTHER: "Charge",
};

// Auto-suggested charge amount + the one-line rationale shown under the field.
export interface ChargeSuggest {
  rupees: string; // prefill value, e.g. "329"
  label: string; // "₹329"
  hint: string;
}

// One row in a bucket's ledger: a charge raised (+) or a payment received (−).
export interface LedgerEntryDTO {
  id: string;
  kind: "charge" | "payment";
  title: string;
  by: string;
  date: string;
  amount: string; // signed, e.g. "+₹1,500" / "−₹500"
  positive: boolean;
  editAmount: string; // rupees, for prefilling the edit form
  editDate: string; // yyyy-mm-dd
  editReason?: string; // charge reason enum, for prefilling the reason chips
  editNote?: string; // free-text "Other" description, for prefilling the edit form
}

// What an inactive member must settle to return to equal value (PRODUCT.md §12).
export interface RejoinDTO {
  total: string; // back deposits + catch-up
  depDue: string; // back deposits owed = full monthly deposits since club start
  depDueRupees: number; // same, raw rupees (modal recomputes the live total)
  profit: string; // catch-up = equal per-member profit share
  profitRupees: number; // same, raw rupees (prefills the editable catch-up field)
}

// Suggested payout when an active member leaves (PRODUCT.md §12): capital + profit − loan − unpaid interest.
export interface SettleDTO {
  guide: string; // formatted suggested settlement
  guideRupees: number; // raw rupees, prefills the editable final-amount field
  capital: string; // paid-in capital = deposits + catch-up (their value)
  profit: string; // profit share (zeroed after leaving)
  loan: string; // outstanding loan principal (subtracted)
  interest: string; // unpaid interest (subtracted)
  owes: boolean; // has a loan / interest to subtract → show the minus rows
}

// Frozen settlement guide for a CLOSED membership (§12) — the breakdown shown at leave + what was paid.
export interface SettledGuideDTO {
  capital: string; // paid-in capital returned
  profit: string; // profit share paid
  loan: string; // loan principal cleared
  interest: string; // unpaid interest cleared
  suggested: string; // guide total
  paid: string; // final amount actually paid out
  owes: boolean; // had loan/interest deducted → show the minus rows
  date: string; // leave date
}

export interface MemberDetailDTO extends MemberDTO {
  membershipId: string;
  phone: string;
  email: string;
  username: string;
  rejoin: RejoinDTO | null;
  settle: SettleDTO | null;
  settledGuide: SettledGuideDTO | null;
  tenure: string;
  managing: string | null;
  loanTaken: string;
  interestDue: string;
  returnsActual: string;
  fullShare: string;
  paidRatioPct: number;
  periodic: string;
  catchup: string;
  totalDeposit: string;
  depositPending: string | null;
  overallPending: string | null;
  ledgerAssigned: string;
  ledgerPaid: string;
  ledgerRemaining: string;
  ledgerPct: number;
  penaltyAssigned: string;
  penaltyPaid: string;
  penaltyRemaining: string;
  penaltyPct: number;
  ledgerRemainingRupees: number;
  penaltyRemainingRupees: number;
  catchupSuggest: ChargeSuggest;
  penaltySuggest: ChargeSuggest;
  catchupEntries: LedgerEntryDTO[];
  penaltyEntries: LedgerEntryDTO[];
  treasurerOptions: { id: string; name: string; sub: string }[];
  hasLoans: boolean;
  loanRepaid: string;
  currentLoan: string;
  interestGen: string;
  interestPaid: string;
  cycles: LoanCycleDTO[];
}

export async function getMemberDetail(id: string): Promise<MemberDetailDTO | null> {
  const m = await prisma.member.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      username: true,
      avatarUrl: true,
      customerSince: true,
      archivedAt: true,
      treasury: { select: { balance: true } },
      memberships: {
        orderBy: { seq: "desc" },
        select: {
          id: true,
          status: true,
          leftAt: true,
          settledGuide: true,
          accounts: { select: { id: true, kind: true, balance: true } },
          loans: { orderBy: { startedAt: "desc" }, select: { id: true, requestedAmount: true, principalOutstanding: true, monthlyRateBps: true, startedAt: true, closedAt: true, status: true } },
          charges: { orderBy: { occurredAt: "desc" }, select: { id: true, kind: true, reason: true, amount: true, occurredAt: true, note: true } },
        },
      },
    },
  });
  if (!m) return null;

  const ms = m.memberships[0];
  const active = m.memberships.some((s) => s.status === "ACTIVE");
  const equity = ms?.accounts.find((a) => a.kind === "MEMBER_EQUITY");
  const value = -(equity?.balance ?? 0n);
  const dep = equity ? await prisma.entry.aggregate({ _sum: { amount: true }, where: { accountId: equity.id, transaction: { type: { in: ["PERIODIC_DEPOSIT", "CATCHUP"] } } } }) : { _sum: { amount: null } };
  const deposits = -(dep._sum.amount ?? 0n);
  // proportional share of pooled club profit (same model as the members list; see `profitShare`)
  const clubProfit = await shareableClubProfit();

  const assigned = ms ? (ms.charges.filter((c) => c.kind === "CATCHUP").reduce((s, c) => s + c.amount, 0n)) : 0n;
  const penaltyAssigned = ms ? (ms.charges.filter((c) => c.kind === "PENALTY").reduce((s, c) => s + c.amount, 0n)) : 0n;
  const paidDown = assigned - (ms ? await outstandingCharge(ms.id, "CATCHUP") : 0n); // magnitude actually paid
  const penaltyPaidDown = penaltyAssigned - (ms ? await outstandingCharge(ms.id, "PENALTY") : 0n);
  // Remaining clamped ≥0 (imported pay-downs can exist without a charge → overpaid vs ₹0).
  const pendingCharge = assigned - paidDown > 0n ? assigned - paidDown : 0n;
  const penaltyCharge = penaltyAssigned - penaltyPaidDown > 0n ? penaltyAssigned - penaltyPaidDown : 0n;
  const pct = (paid: bigint, total: bigint) => (total > 0n ? Math.min(100, Number((paid * 100n) / total)) : 100);

  const memberName = [m.firstName, m.lastName].filter(Boolean).join(" ");
  // Ledger rows per bucket = charges raised (+) merged with payments received (−), newest first.
  const payments = ms
    ? await prisma.transaction.findMany({
        where: { membershipId: ms.id, type: { in: ["CATCHUP", "PENALTY"] } },
        orderBy: { occurredAt: "desc" },
        select: { id: true, type: true, occurredAt: true, entries: { select: { amount: true } } },
      })
    : [];
  const chargeRow = (c: (typeof ms.charges)[number]) => ({
    ts: c.occurredAt.getTime(),
    row: {
      id: c.id,
      kind: "charge" as const,
      title: c.note?.trim() || REASON_LABEL[c.reason] || "Charge",
      by: "Charged by admin",
      date: dayMonthYear(c.occurredAt),
      amount: "+" + formatPaise(c.amount),
      positive: true,
      editAmount: String(Number(c.amount) / 100),
      editDate: c.occurredAt.toISOString().slice(0, 10),
      editReason: c.reason,
      editNote: c.note ?? "",
    },
  });
  const paymentRow = (t: (typeof payments)[number]) => {
    const amt = t.entries.reduce((mx, e) => (e.amount > mx ? e.amount : mx), 0n); // positive (treasury) leg
    return {
      ts: t.occurredAt.getTime(),
      row: {
        id: t.id,
        kind: "payment" as const,
        title: "Payment received",
        by: `Paid by ${memberName}`,
        date: dayMonthYear(t.occurredAt),
        amount: "−" + formatPaise(amt),
        positive: false,
        editAmount: String(Number(amt) / 100),
        editDate: t.occurredAt.toISOString().slice(0, 10),
      },
    };
  };
  const entriesFor = (kind: "CATCHUP" | "PENALTY"): LedgerEntryDTO[] =>
    [
      ...(ms?.charges.filter((c) => c.kind === kind).map(chargeRow) ?? []),
      ...payments.filter((t) => t.type === kind).map(paymentRow),
    ]
      .sort((a, b) => b.ts - a.ts)
      .map((e) => e.row);

  // Monthly-deposit pending = full-club-life expected (club start → today) − paid (deposits +
  // catch-up). Same baseline for every active member. Overall pending sums all three buckets.
  const cfg = await prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { stages: true } });
  const stages = (cfg?.stages as Stage[] | undefined) ?? [];
  // Full-club-life baseline (club start → today) — same for everyone, incl. an inactive member
  // computing what it'd take to rejoin. depositPending stays active-only (an inactive member
  // owes nothing until they return).
  const expectedDeposit = expectedClubDeposit(stages);
  const depositPending = active && expectedDeposit > deposits ? expectedDeposit - deposits : 0n;
  const overallPending = depositPending + pendingCharge + penaltyCharge;
  const activeCount = await prisma.membership.count({ where: { status: "ACTIVE" } });
  // Profit is split over the EXPECTED base (members × expected), so `fullShare` is the fair full
  // per-head share (clubProfit ÷ members) and `returnsActual` = fullShare × paidPct. A fully-paid
  // member is unaffected by others being behind; each underpayer bears their own shortfall; the sum
  // over members never exceeds clubProfit (PRODUCT.md §11 — see `profitShare`).
  const profit = active ? profitShare(clubProfit, deposits, activeCount, expectedDeposit) : 0n;
  const fullShare = active ? profitShare(clubProfit, expectedDeposit, activeCount, expectedDeposit) : 0n;
  const paidRatioPct = pct(deposits, expectedDeposit);

  // Auto-suggested charge amounts (FORMS_AND_FIELDS §Add charge):
  //   catch-up = avg per-member profit − this member's profit;  penalty = 2% of pending dues.
  const avgProfit = activeCount > 0 ? clubProfit / BigInt(activeCount) : 0n;
  const suggest = (paise: bigint, hint: string): ChargeSuggest => ({ rupees: String(Number(paise) / 100), label: formatPaise(paise), hint });
  const catchupSuggest = suggest(avgProfit > profit ? avgProfit - profit : 0n, "avg per-member profit minus this member's profit");
  // Rejoin quote (inactive members only): the FULL monthly deposits since club start + equal
  // per-member profit. A prior stint's deposits were paid back at settlement, so the new membership
  // starts at 0 paid — they owe the whole baseline afresh (PRODUCT.md §12).
  const backDeposits = expectedDeposit;
  const rejoin: RejoinDTO | null = active
    ? null
    : {
        total: formatPaise(backDeposits + avgProfit),
        depDue: formatPaise(backDeposits),
        depDueRupees: Number(backDeposits) / 100,
        profit: formatPaise(avgProfit),
        profitRupees: Number(avgProfit) / 100,
      };
  const penaltySuggest = suggest((depositPending * 2n) / 100n, "2% of this member's pending dues");
  const treasurers = await getCashHolderOptions();

  const loans = ms?.loans ?? [];
  const activeLoan = loans.find((l) => l.status === "ACTIVE");
  const currentLoan = activeLoan?.principalOutstanding ?? 0n;
  const loanTaken = loans.reduce((s, l) => s + l.requestedAmount, 0n);
  const loanRepaid = loans.reduce((s, l) => s + (l.requestedAmount - l.principalOutstanding), 0n);
  // interest collected on this member's loans = LOAN_INTEREST cash legs tied to their memberships
  const intPaidAgg = await prisma.entry.aggregate({ _sum: { amount: true }, where: { amount: { gt: 0 }, transaction: { type: "LOAN_INTEREST", membershipId: { in: m.memberships.map((x) => x.id) } } } });
  const interestPaid = intPaidAgg._sum.amount ?? 0n;

  // Reconstruct loan history as cycles: replay each loan's tranches/repays so every
  // balance change opens a new cycle (PRODUCT.md §9), numbered 1..N oldest→newest, then
  // shown most-recent first.
  const now = new Date();
  const loanCfg = await loanConfig();
  const cycles: LoanCycleDTO[] = [];
  let interestGen = 0n;
  for (const l of [...loans].reverse()) {
    const events = await loanEvents(l.id);
    const overdueLoan = l.status === "ACTIVE" && isOverdue(l.startedAt, loanCfg, now);
    for (const c of reconstructCycles(events, l.monthlyRateBps, now, loanCfg.dayInterestFrom)) {
      interestGen += c.interest;
      const status = !c.open ? "closed" : overdueLoan ? "overdue" : "active";
      cycles.push({
        n: cycles.length + 1,
        status,
        statusLabel: status === "closed" ? "Closed" : status === "overdue" ? "Overdue" : "Active",
        amt: formatPaise(c.balance),
        start: monthYear(c.start),
        end: c.open ? "now" : monthYear(c.end),
        rate: String(l.monthlyRateBps / 100),
        days: monthsDays(daysBetween(c.start, c.end)),
        interest: formatPaise(c.interest),
      });
    }
  }
  cycles.reverse(); // most-recent cycle first
  const interestDue = interestGen > interestPaid ? interestGen - interestPaid : 0n;

  // Settlement guide for an active member leaving (§12): capital + profit − loan − unpaid interest.
  const settleRaw = value + profit - currentLoan - interestDue;
  const settle: SettleDTO | null = active
    ? {
        guide: formatPaise(settleRaw > 0n ? settleRaw : 0n),
        guideRupees: Number(settleRaw > 0n ? settleRaw : 0n) / 100,
        capital: formatPaise(value),
        profit: formatPaise(profit),
        loan: formatPaise(currentLoan),
        interest: formatPaise(interestDue),
        owes: currentLoan > 0n || interestDue > 0n,
      }
    : null;

  return {
    id: m.id,
    membershipId: ms?.id ?? "",
    phone: m.phone ?? "",
    email: m.email ?? "",
    username: m.username ?? "",
    rejoin,
    settle,
    name: [m.firstName, m.lastName].filter(Boolean).join(" "),
    avatarUrl: m.avatarUrl,
    joined: monthYear(m.customerSince),
    deposits: formatPaise(deposits),
    profit: formatPaise(profit),
    value: active ? formatPaise(value) : "—",
    held: m.treasury ? formatPaise(m.treasury.balance) : null,
    adjustment: pendingCharge + penaltyCharge > 0n ? formatPaise(pendingCharge + penaltyCharge) : null,
    adjustmentCharged: assigned + penaltyAssigned > 0n ? formatPaise(assigned + penaltyAssigned) : null,
    pending: pendingCharge > 0n ? formatPaise(pendingCharge) : null,
    status: memberStatus(active, m.archivedAt),
    tenure: tenure(m.customerSince),
    managing: m.treasury ? formatPaise(m.treasury.balance) : null,
    loanTaken: formatPaise(loanTaken),
    interestDue: formatPaise(interestDue),
    returnsActual: formatPaise(profit),
    fullShare: formatPaise(fullShare),
    paidRatioPct: paidRatioPct,
    periodic: formatPaise(deposits),
    catchup: formatPaise(paidDown),
    totalDeposit: formatPaise(deposits),
    depositPending: depositPending > 0n ? formatPaise(depositPending) : null,
    overallPending: overallPending > 0n ? formatPaise(overallPending) : null,
    ledgerAssigned: formatPaise(assigned),
    ledgerPaid: formatPaise(paidDown),
    ledgerRemaining: formatPaise(pendingCharge),
    ledgerPct: pct(paidDown, assigned),
    penaltyAssigned: formatPaise(penaltyAssigned),
    penaltyPaid: formatPaise(penaltyPaidDown),
    penaltyRemaining: formatPaise(penaltyCharge),
    penaltyPct: pct(penaltyPaidDown, penaltyAssigned),
    ledgerRemainingRupees: Number(pendingCharge) / 100,
    penaltyRemainingRupees: Number(penaltyCharge) / 100,
    catchupSuggest,
    penaltySuggest,
    catchupEntries: entriesFor("CATCHUP"),
    penaltyEntries: entriesFor("PENALTY"),
    treasurerOptions: treasurers,
    hasLoans: loans.length > 0,
    loanRepaid: formatPaise(loanRepaid),
    currentLoan: formatPaise(currentLoan),
    interestGen: formatPaise(interestGen),
    interestPaid: formatPaise(interestPaid),
    cycles,
  };
}
