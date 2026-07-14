import "server-only";
import { prisma } from "@/server/db";
import { formatPaise, profitShare } from "@/lib/money";
import { monthYear, tenure, dayMonthYear, istDate, addMonths } from "@/lib/date";
import { loanEventsMap, reconstructCycles, loanConfig, isOverdue, interestOwedTotal, loanCycleDTOs, type LoanCfg, type LoanCycleDTO } from "./loans";
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
  value: string; // deposits + adjust (paid) + profit share
  held: string | null;
  adjustment: string | null; // catch-up + penalty STILL OUTSTANDING, combined
  adjustmentCharged: string | null; // catch-up + penalty EVER charged (shown even once fully paid)
  sort?: MemberSort; // raw numeric keys for client-side column sorting (list rows only)
  pending: string | null; // deposit pending + adjust (outstanding) pending
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
  const raised = await prisma.charge.aggregate({ _sum: { amount: true }, where: { membershipId, kind, voidedAt: null } });
  const paid = await prisma.entry.aggregate({
    _sum: { amount: true },
    where: { transaction: { membershipId, type: kind, reversed: false }, account: { kind: kind === "CATCHUP" ? "MEMBER_EQUITY" : "OTHER_INCOME" } },
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
  // Everything the per-member rows need is fetched in a handful of batched queries (no N+1):
  // deposits per equity account, charges raised per membership+kind, and charge pay-down legs.
  const equityIds = members.flatMap((m) => m.memberships.flatMap((s) => s.accounts)).map((a) => a.id);
  const membershipIds = members.map((m) => m.memberships[0]?.id).filter((x): x is string => !!x);
  const [cfg, clubProfit, depGroups, periodicGroups, raisedGroups, paidRows] = await Promise.all([
    prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { stages: true } }),
    // Profit isn't posted to member equity in this ledger — it pools in the club (interest + vendor
    // returns). Split it over the EXPECTED deposit base (active members × expected-per-member) so a
    // fully-paid member always earns their full share regardless of others, each underpayer bears
    // their own shortfall, and the club never distributes more than it earned (§11, see `profitShare`).
    shareableClubProfit(),
    prisma.entry.groupBy({ by: ["accountId"], _sum: { amount: true }, where: { accountId: { in: equityIds }, transaction: { type: { in: ["PERIODIC_DEPOSIT", "CATCHUP"] }, reversed: false } } }),
    // Periodic-only, for the list "Deposits" column (catch-up shows under Adjustment). Profit/pending
    // still use the combined paid total below (deposits + catch-up), per PRODUCT.md §6/§11.
    prisma.entry.groupBy({ by: ["accountId"], _sum: { amount: true }, where: { accountId: { in: equityIds }, transaction: { type: "PERIODIC_DEPOSIT", reversed: false } } }),
    prisma.charge.groupBy({ by: ["membershipId", "kind"], _sum: { amount: true }, where: { membershipId: { in: membershipIds }, kind: { in: ["CATCHUP", "PENALTY"] }, voidedAt: null } }),
    prisma.entry.findMany({
      where: { transaction: { membershipId: { in: membershipIds }, type: { in: ["CATCHUP", "PENALTY"] }, reversed: false }, account: { kind: { in: ["MEMBER_EQUITY", "OTHER_INCOME"] } } },
      select: { amount: true, account: { select: { kind: true } }, transaction: { select: { membershipId: true, type: true } } },
    }),
  ]);
  const expectedDeposit = expectedClubDeposit((cfg?.stages as Stage[] | undefined) ?? []);
  const depByAcct = new Map(depGroups.map((d) => [d.accountId, -(d._sum.amount ?? 0n)])); // equity is credit → negate
  const periodicByAcct = new Map(periodicGroups.map((d) => [d.accountId, -(d._sum.amount ?? 0n)])); // display-only (excludes catch-up)
  const raisedByMsKind = new Map(raisedGroups.map((g) => [`${g.membershipId}:${g.kind}`, g._sum.amount ?? 0n]));
  // Pay-downs credit the charge account with a negative leg; outstanding = raised + Σ pay-down legs.
  // Match `outstandingCharge`'s account filter exactly: CATCHUP pays down MEMBER_EQUITY, PENALTY OTHER_INCOME.
  const paidByMsKind = new Map<string, bigint>();
  const paidAcctKind = (type: string) => (type === "CATCHUP" ? "MEMBER_EQUITY" : "OTHER_INCOME");
  for (const e of paidRows) {
    if (!e.transaction.membershipId || e.account.kind !== paidAcctKind(e.transaction.type)) continue;
    const key = `${e.transaction.membershipId}:${e.transaction.type}`;
    paidByMsKind.set(key, (paidByMsKind.get(key) ?? 0n) + e.amount);
  }
  const outstandingOf = (msId: string, kind: "CATCHUP" | "PENALTY") =>
    (raisedByMsKind.get(`${msId}:${kind}`) ?? 0n) + (paidByMsKind.get(`${msId}:${kind}`) ?? 0n);

  const rows = members.map((m) => {
    const active = m.memberships.some((s) => s.status === "ACTIVE");
    const equity = m.memberships.flatMap((s) => s.accounts)[0];
    const value = -(equity?.balance ?? 0n);
    const deposits = equity ? depByAcct.get(equity.id) ?? 0n : 0n;
    const periodic = equity ? periodicByAcct.get(equity.id) ?? 0n : 0n; // display-only (deposits column)
    const membershipId = m.memberships[0]?.id;
    const penalty = membershipId ? outstandingOf(membershipId, "PENALTY") : 0n;
    const catchup = membershipId ? outstandingOf(membershipId, "CATCHUP") : 0n;
    const adjustment = (penalty > 0n ? penalty : 0n) + (catchup > 0n ? catchup : 0n);
    const charged = membershipId ? (raisedByMsKind.get(`${membershipId}:CATCHUP`) ?? 0n) + (raisedByMsKind.get(`${membershipId}:PENALTY`) ?? 0n) : 0n;
    // Deposit due is measured against PERIODIC deposits only — catch-up is profit-gap equalisation
    // (PRODUCT.md §7), not a monthly deposit, so it doesn't reduce the deposit shortfall.
    const pending = active && expectedDeposit > periodic ? expectedDeposit - periodic : 0n;
    return { m, active, value, deposits, periodic, pending, adjustment, charged };
  });
  const activeCount = rows.filter((r) => r.active).length;
  const shareOf = (deposits: bigint, active: boolean) =>
    active ? profitShare(clubProfit, deposits, activeCount, expectedDeposit) : 0n;

  return rows
    .map(({ m, active, value, deposits, periodic, pending, adjustment, charged }) => {
      const profit = shareOf(deposits, active);
      const worth = value + profit; // Value column = deposits + adjust (paid) + profit
      const pendingTotal = pending + adjustment; // Pending column = deposit pending + adjust pending
      return {
      id: m.id,
      name: [m.firstName, m.lastName].filter(Boolean).join(" "),
      avatarUrl: m.avatarUrl,
      joined: monthYear(m.customerSince),
      deposits: formatPaise(periodic), // monthly deposits only; catch-up shows under Adjustment
      profit: formatPaise(profit),
      value: active ? formatPaise(worth) : "—",
      held: m.treasury[0] && m.treasury[0].balance !== 0n ? formatPaise(m.treasury[0].balance) : null,
      adjustment: adjustment > 0n ? formatPaise(adjustment) : null,
      adjustmentCharged: charged > 0n ? formatPaise(charged) : null,
      pending: pendingTotal > 0n ? formatPaise(pendingTotal) : null,
      status: memberStatus(active, m.archivedAt),
      sort: {
        name: [m.firstName, m.lastName].filter(Boolean).join(" "),
        deposits: Number(periodic),
        profit: Number(profit),
        value: Number(worth),
        held: Number(m.treasury[0]?.balance ?? 0n),
        adjustment: Number(charged),
        pending: Number(pendingTotal),
        status: active ? 0 : m.archivedAt ? 2 : 1,
      },
      };
    })
    // Active members first, then alphabetical by name.
    .sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || a.name.localeCompare(b.name));
}

/** Shareable club profit = loan interest + other income + vendor P/L. Vendor P/L already nets chit
 *  obligations still owed and projects un-taken chit face value (PRODUCT.md §10/§11). */
export async function realizedClubProfit(): Promise<bigint> {
  const [income, vpo] = await Promise.all([
    prisma.ledgerAccount.aggregate({
      _sum: { balance: true },
      where: { kind: { in: ["INTEREST_INCOME", "OTHER_INCOME"] }, id: { not: "club-opening" } },
    }),
    vendorProfitAndObligation(),
  ]);
  return -(income._sum.balance ?? 0n) + vpo.profit; // credit accounts hold negative balances
}

/** Pooled profit that ACTIVE members share (PRODUCT.md §11):
 *    realized (net of chit obligation) + pending loan interest − profit already withdrawn by leavers.
 *  Pending interest counts because the club will collect it. The withdrawn term matters because a
 *  WITHDRAW only moves cash → the leaver's equity (intents.ts) — it never debits the income
 *  accounts, so a leaver's profit lingers inside `realizedClubProfit`. Without subtracting it, active
 *  members would be credited profit that has already left the club as cash, and the club would fall
 *  exactly that short if everyone settled at once. Mirrors the dashboard's `currentProfit`. */
export async function shareableClubProfit(): Promise<bigint> {
  const [realized, owed, withdrawn] = await Promise.all([realizedClubProfit(), interestOwedTotal(), profitWithdrawnTotal()]);
  return realized + owed - withdrawn;
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
  const [cfg, active] = await Promise.all([
    prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { stages: true } }),
    prisma.membership.findMany({
      where: { status: "ACTIVE" },
      select: { accounts: { where: { kind: "MEMBER_EQUITY" }, select: { id: true, balance: true } } },
    }),
  ]);
  const expected = expectedClubDeposit((cfg?.stages as Stage[] | undefined) ?? []);
  // One grouped query for all active equity accounts instead of an aggregate per membership.
  const equityIds = active.flatMap((ms) => ms.accounts).map((a) => a.id);
  const [depGroups, periodicGroups] = await Promise.all([
    prisma.entry.groupBy({ by: ["accountId"], _sum: { amount: true }, where: { accountId: { in: equityIds }, transaction: { type: { in: ["PERIODIC_DEPOSIT", "CATCHUP"] }, reversed: false } } }),
    prisma.entry.groupBy({ by: ["accountId"], _sum: { amount: true }, where: { accountId: { in: equityIds }, transaction: { type: "PERIODIC_DEPOSIT", reversed: false } } }),
  ]);
  const depByAcct = new Map(depGroups.map((d) => [d.accountId, -(d._sum.amount ?? 0n)]));
  const periodicByAcct = new Map(periodicGroups.map((d) => [d.accountId, -(d._sum.amount ?? 0n)]));
  let activeDeposits = 0n, value = 0n, pendingTotal = 0n, pendingCount = 0;
  for (const ms of active) {
    const eq = ms.accounts[0];
    if (!eq) continue;
    activeDeposits += depByAcct.get(eq.id) ?? 0n;
    value += -(eq.balance ?? 0n);
    // Deposit due vs PERIODIC deposits only (catch-up is profit-gap, not a monthly deposit — §7).
    const periodic = periodicByAcct.get(eq.id) ?? 0n;
    if (expected > periodic) { pendingTotal += expected - periodic; pendingCount++; }
  }
  const n = active.length;
  return { activeMembers: n, activeDeposits, avgBalance: n ? value / BigInt(n) : 0n, pendingTotal, pendingCount };
}

/** Club-wide charge totals for a kind (paise): assigned (raised), collected (paid down), pending. */
export async function chargeTotals(kind: "CATCHUP" | "PENALTY"): Promise<{ assigned: bigint; collected: bigint; pending: bigint }> {
  const raised = await prisma.charge.aggregate({ _sum: { amount: true }, where: { kind, voidedAt: null } });
  const paid = await prisma.entry.aggregate({
    _sum: { amount: true },
    where: { transaction: { type: kind, reversed: false }, account: { kind: kind === "CATCHUP" ? "MEMBER_EQUITY" : "OTHER_INCOME" } },
  });
  const assigned = raised._sum.amount ?? 0n;
  const collected = -(paid._sum.amount ?? 0n); // pay-down legs are negative
  return { assigned, collected, pending: assigned - collected };
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
export type { LoanCycleDTO } from "./loans";

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
  AUTO_DEPOSIT_PENALTY: "Deposit penalty (auto)",
  AUTO_LOAN_INTEREST_PENALTY: "Loan-interest penalty (auto)",
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
  note?: string; // charge note, shown under the by·date line (OTHER charges show theirs as title)
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
  periodic: string;         // pure periodic deposits
  catchupPenalty: string;   // catch-up + penalty deposits paid
  depositsTotal: string;    // periodic + catch-up + penalty (Member deposits headline)
  depositPending: string | null;
  overallPending: string | null;
  totalDue: string | null; // overallPending + loan interest due (everything the member owes)
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
  catchupSuggest?: ChargeSuggest; // active members: manual only (no auto profit-gap suggestion)
  penaltySuggest: ChargeSuggest;
  catchupEntries: LedgerEntryDTO[];
  penaltyEntries: LedgerEntryDTO[];
  treasurerOptions: { id: string; name: string; sub: string }[];
  hasLoans: boolean;
  loanRepaid: string;
  currentLoan: string;
  loanStarted: string | null; // active loan: date it started (null when no active loan)
  loanDue: string | null;     // active loan: end of its fixed term (due date)
  loanOverdue: boolean;       // active loan is past its term
  interestGen: string;
  interestPaid: string;
  cycles: LoanCycleDTO[];
}

/** Club-wide invariants that every member-detail statement shares. Computing them once lets a caller
 *  that needs many statements (e.g. the Share posters) avoid recomputing the heavy pooled-profit /
 *  treasurer / config reads N times. `getMemberDetail` computes them itself when none is passed. */
export interface MemberDetailContext {
  clubProfit: bigint;
  activeCount: number;
  stages: Stage[];
  treasurers: Awaited<ReturnType<typeof getCashHolderOptions>>;
  loanCfg: LoanCfg;
}

export async function memberDetailContext(): Promise<MemberDetailContext> {
  const [clubProfit, activeCount, cfg, treasurers, loanCfg] = await Promise.all([
    shareableClubProfit(),
    prisma.membership.count({ where: { status: "ACTIVE" } }),
    prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { stages: true } }),
    getCashHolderOptions(),
    loanConfig(),
  ]);
  return { clubProfit, activeCount, stages: (cfg?.stages as Stage[] | undefined) ?? [], treasurers, loanCfg };
}

export async function getMemberDetail(id: string, ctx?: MemberDetailContext): Promise<MemberDetailDTO | null> {
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
          charges: { where: { voidedAt: null }, orderBy: { occurredAt: "desc" }, select: { id: true, kind: true, reason: true, amount: true, occurredAt: true, note: true, auto: true } },
        },
      },
    },
  });
  if (!m) return null;

  // Club-wide invariants once (injected by batch callers like the Share posters; otherwise computed).
  const context = ctx ?? (await memberDetailContext());
  const ms = m.memberships[0];
  const active = m.memberships.some((s) => s.status === "ACTIVE");
  const equity = ms?.accounts.find((a) => a.kind === "MEMBER_EQUITY");
  const value = -(equity?.balance ?? 0n);
  const loans = ms?.loans ?? [];
  // proportional share of pooled club profit (same model as the members list; see `profitShare`)
  const clubProfit = context.clubProfit;

  // All per-member reads in one batch (deposits, charge pay-downs, ledger payments, loan-interest
  // paid, loan events for every loan) — no await-per-charge / await-per-loan waterfalls.
  const [dep, depCatchup, catchupOut, penaltyOut, payments, intPaidAgg, eventsMap] = await Promise.all([
    equity
      ? prisma.entry.aggregate({ _sum: { amount: true }, where: { accountId: equity.id, transaction: { type: { in: ["PERIODIC_DEPOSIT", "CATCHUP"] }, reversed: false } } })
      : Promise.resolve({ _sum: { amount: null } }),
    equity
      ? prisma.entry.aggregate({ _sum: { amount: true }, where: { accountId: equity.id, transaction: { type: "CATCHUP", reversed: false } } })
      : Promise.resolve({ _sum: { amount: null } }),
    ms ? outstandingCharge(ms.id, "CATCHUP") : Promise.resolve(0n),
    ms ? outstandingCharge(ms.id, "PENALTY") : Promise.resolve(0n),
    ms
      ? prisma.transaction.findMany({
          where: { membershipId: ms.id, type: { in: ["CATCHUP", "PENALTY"] }, reversed: false },
          orderBy: { occurredAt: "desc" },
          select: { id: true, type: true, occurredAt: true, entries: { select: { amount: true } } },
        })
      : Promise.resolve([]),
    prisma.entry.aggregate({ _sum: { amount: true }, where: { amount: { gt: 0 }, transaction: { type: "LOAN_INTEREST", membershipId: { in: m.memberships.map((x) => x.id) }, reversed: false } } }),
    loanEventsMap(loans.map((l) => l.id)),
  ]);
  const deposits = -(dep._sum.amount ?? 0n); // periodic + catch-up equity money (feeds profit share — do not repurpose)
  const catchupDeposit = -(depCatchup._sum.amount ?? 0n);
  const periodicPure = deposits - catchupDeposit;

  const assigned = ms ? ms.charges.filter((c) => c.kind === "CATCHUP").reduce((s, c) => s + c.amount, 0n) : 0n;
  const penaltyAssigned = ms ? ms.charges.filter((c) => c.kind === "PENALTY").reduce((s, c) => s + c.amount, 0n) : 0n;
  const paidDown = assigned - catchupOut; // magnitude actually paid
  const penaltyPaidDown = penaltyAssigned - penaltyOut;
  // Remaining clamped ≥0 (imported pay-downs can exist without a charge → overpaid vs ₹0).
  const pendingCharge = assigned - paidDown > 0n ? assigned - paidDown : 0n;
  const penaltyCharge = penaltyAssigned - penaltyPaidDown > 0n ? penaltyAssigned - penaltyPaidDown : 0n;
  const pct = (paid: bigint, total: bigint) => (total > 0n ? Math.min(100, Number((paid * 100n) / total)) : 100);

  const memberName = [m.firstName, m.lastName].filter(Boolean).join(" ");
  // Ledger rows per bucket = charges raised (+) merged with payments received (−), newest first.
  const chargeRow = (c: (typeof ms.charges)[number]) => ({
    ts: c.occurredAt.getTime(),
    row: {
      id: c.id,
      kind: "charge" as const,
      // The reason is the row's title; the note is detail underneath. Except OTHER: its custom
      // wording lives in the note column and IS the reason (see AddChargeDialog).
      title: (c.reason === "OTHER" && c.note?.trim()) || REASON_LABEL[c.reason] || "Charge",
      note: c.reason === "OTHER" ? undefined : c.note?.trim() || undefined,
      by: c.auto ? "Charged by auto scheduler" : "Charged by admin",
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
  const stages = context.stages;
  // Full-club-life baseline (club start → today) — same for everyone, incl. an inactive member
  // computing what it'd take to rejoin. depositPending stays active-only (an inactive member
  // owes nothing until they return).
  const expectedDeposit = expectedClubDeposit(stages);
  // Deposit due vs PERIODIC deposits only — catch-up is profit-gap equalisation (§7), not a monthly deposit.
  const depositPending = active && expectedDeposit > periodicPure ? expectedDeposit - periodicPure : 0n;
  const overallPending = depositPending + pendingCharge + penaltyCharge;
  const activeCount = context.activeCount;
  // Profit is split over the EXPECTED base (members × expected), so `fullShare` is the fair full
  // per-head share (clubProfit ÷ members) and `returnsActual` = fullShare × paidPct. A fully-paid
  // member is unaffected by others being behind; each underpayer bears their own shortfall; the sum
  // over members never exceeds clubProfit (PRODUCT.md §11 — see `profitShare`).
  const profit = active ? profitShare(clubProfit, deposits, activeCount, expectedDeposit) : 0n;
  const fullShare = active ? profitShare(clubProfit, expectedDeposit, activeCount, expectedDeposit) : 0n;
  const paidRatioPct = pct(deposits, expectedDeposit);

  // Auto-suggested charge amounts (FORMS_AND_FIELDS §Add charge). Active members get NO catch-up
  // suggestion: they equalise by paying their Deposit due (measured over the full club life), which
  // also restores their full profit share — an auto profit-gap catch-up would double-count that same
  // shortfall (PRODUCT.md §7). Catch-up stays admin-manual for active members; the rejoin flow (below)
  // still auto-suggests for returning members. Penalty = 2% of pending dues.
  const avgProfit = activeCount > 0 ? clubProfit / BigInt(activeCount) : 0n;
  const suggest = (paise: bigint, hint: string): ChargeSuggest => ({ rupees: String(Number(paise) / 100), label: formatPaise(paise), hint });
  const catchupSuggest = undefined; // manual only for active members (see above)
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
  const treasurers = context.treasurers;

  const activeLoan = loans.find((l) => l.status === "ACTIVE");
  const currentLoan = activeLoan?.principalOutstanding ?? 0n;
  const loanTaken = loans.reduce((s, l) => s + l.requestedAmount, 0n);
  const loanRepaid = loans.reduce((s, l) => s + (l.requestedAmount - l.principalOutstanding), 0n);
  // interest collected on this member's loans = LOAN_INTEREST cash legs tied to their memberships
  const interestPaid = intPaidAgg._sum.amount ?? 0n;

  // Reconstruct loan history as cycles: replay each loan's tranches/repays so every
  // balance change opens a new cycle (PRODUCT.md §9), numbered 1..N oldest→newest, then
  // shown most-recent first.
  const now = new Date();
  const loanCfg = context.loanCfg;
  // Active loan window: start date and the end of its fixed term (start + loanTermMonths, §8).
  const loanDueDate = activeLoan ? addMonths(istDate(activeLoan.startedAt), loanCfg.loanTermMonths) : null;
  const loanStarted = activeLoan ? dayMonthYear(activeLoan.startedAt) : null;
  const loanDue = loanDueDate ? dayMonthYear(loanDueDate) : null;
  const loanOverdue = activeLoan ? isOverdue(activeLoan.startedAt, loanCfg, now) : false;
  const cycles: LoanCycleDTO[] = [];
  let interestGen = 0n;
  for (const l of [...loans].reverse()) {
    const events = eventsMap.get(l.id) ?? [];
    const overdueLoan = l.status === "ACTIVE" && isOverdue(l.startedAt, loanCfg, now);
    interestGen += reconstructCycles(events, l.monthlyRateBps, now, loanCfg.dayInterestFrom).reduce((s, c) => s + c.interest, 0n);
    cycles.push(...loanCycleDTOs(events, l.monthlyRateBps, now, loanCfg, overdueLoan));
  }
  cycles.forEach((c, i) => (c.n = i + 1)); // renumber 1..N across ALL the member's loans, oldest first
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

  // Frozen guide for a closed stint (§12): read the snapshot taken at settlement (paise as strings).
  const sg = ms?.settledGuide as Record<string, string> | null | undefined;
  const settledGuide: SettledGuideDTO | null =
    !active && sg
      ? {
          capital: formatPaise(BigInt(sg.capital ?? "0")),
          profit: formatPaise(BigInt(sg.profit ?? "0")),
          loan: formatPaise(BigInt(sg.loan ?? "0")),
          interest: formatPaise(BigInt(sg.interest ?? "0")),
          suggested: formatPaise(BigInt(sg.suggested ?? "0")),
          paid: formatPaise(BigInt(sg.paid ?? "0")),
          owes: BigInt(sg.loan ?? "0") > 0n || BigInt(sg.interest ?? "0") > 0n,
          date: ms?.leftAt ? dayMonthYear(ms.leftAt) : "—",
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
    settledGuide,
    name: [m.firstName, m.lastName].filter(Boolean).join(" "),
    avatarUrl: m.avatarUrl,
    joined: monthYear(m.customerSince),
    deposits: formatPaise(deposits),
    profit: formatPaise(profit),
    value: active ? formatPaise(value) : "—",
    held: m.treasury[0] ? formatPaise(m.treasury[0].balance) : null,
    adjustment: pendingCharge + penaltyCharge > 0n ? formatPaise(pendingCharge + penaltyCharge) : null,
    adjustmentCharged: assigned + penaltyAssigned > 0n ? formatPaise(assigned + penaltyAssigned) : null,
    pending: pendingCharge > 0n ? formatPaise(pendingCharge) : null,
    status: memberStatus(active, m.archivedAt),
    tenure: tenure(m.customerSince),
    managing: m.treasury[0] ? formatPaise(m.treasury[0].balance) : null,
    loanTaken: formatPaise(loanTaken),
    interestDue: formatPaise(interestDue),
    returnsActual: formatPaise(profit),
    fullShare: formatPaise(fullShare),
    paidRatioPct: paidRatioPct,
    periodic: formatPaise(periodicPure),
    catchupPenalty: formatPaise(catchupDeposit + penaltyPaidDown),
    depositsTotal: formatPaise(deposits + penaltyPaidDown),
    depositPending: depositPending > 0n ? formatPaise(depositPending) : null,
    overallPending: overallPending > 0n ? formatPaise(overallPending) : null,
    totalDue: overallPending + interestDue > 0n ? formatPaise(overallPending + interestDue) : null,
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
    loanStarted,
    loanDue,
    loanOverdue,
    interestGen: formatPaise(interestGen),
    interestPaid: formatPaise(interestPaid),
    cycles,
  };
}
