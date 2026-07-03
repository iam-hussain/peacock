import "server-only";
import { prisma } from "@/server/db";
import { formatLakh, formatPaise } from "@/lib/money";
import { monthYear, tenure, daysBetween } from "@/lib/date";
import type { Status } from "@/components/shared/status-badge";

export interface MemberDTO {
  id: string;
  name: string;
  joined: string;
  deposits: string;
  profit: string;
  value: string;
  held: string | null;
  penalty: string | null;
  pending: string | null;
  status: Status;
}

// Sum of a charge kind still outstanding for a membership (raised − paid down).
async function outstandingCharge(membershipId: string, kind: "CATCHUP" | "PENALTY"): Promise<bigint> {
  const raised = await prisma.charge.aggregate({ _sum: { amount: true }, where: { membershipId, kind } });
  const paid = await prisma.entry.aggregate({
    _sum: { amount: true },
    where: { transaction: { membershipId, type: kind }, account: { kind: kind === "CATCHUP" ? "MEMBER_EQUITY" : "OTHER_INCOME" } },
  });
  return (raised._sum.amount ?? 0n) - (paid._sum.amount ?? 0n);
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
      customerSince: true,
      archivedAt: true,
      treasury: { select: { balance: true } },
      memberships: { select: { id: true, status: true, accounts: { where: { kind: "MEMBER_EQUITY" }, select: { id: true, balance: true } } } },
    },
  });

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
      const pending = membershipId ? await outstandingCharge(membershipId, "CATCHUP") : 0n;
      const penalty = membershipId ? await outstandingCharge(membershipId, "PENALTY") : 0n;
      return { m, active, value, deposits, pending, penalty };
    }),
  );

  // Profit isn't posted to member equity in this ledger — it pools in the club
  // (interest + vendor returns). Share it proportionally to deposits among ACTIVE
  // members (§ PRODUCT.md: profit shared proportionally to deposits paid).
  const clubProfit = await realizedClubProfit();
  const totalActiveDeposits = rows.filter((r) => r.active).reduce((s, r) => s + r.deposits, 0n);
  const shareOf = (deposits: bigint, active: boolean) =>
    active && totalActiveDeposits > 0n ? (clubProfit * deposits) / totalActiveDeposits : 0n;

  return rows.map(({ m, active, value, deposits, pending, penalty }) => ({
    id: m.id,
    name: [m.firstName, m.lastName].filter(Boolean).join(" "),
    joined: monthYear(m.customerSince),
    deposits: formatLakh(deposits),
    profit: formatPaise(shareOf(deposits, active)),
    value: active ? formatLakh(value) : "—",
    held: m.treasury && m.treasury.balance !== 0n ? formatLakh(m.treasury.balance) : null,
    penalty: penalty > 0n ? formatPaise(penalty) : null,
    pending: pending > 0n ? formatPaise(pending) : null,
    status: memberStatus(active, m.archivedAt),
  }));
}

/** Total realized, still-pooled club profit = loan interest + vendor profit + other income. */
async function realizedClubProfit(): Promise<bigint> {
  const income = await prisma.ledgerAccount.aggregate({
    _sum: { balance: true },
    where: { kind: { in: ["INTEREST_INCOME", "VENDOR_PROFIT", "OTHER_INCOME"] }, id: { not: "club-opening" } },
  });
  return -(income._sum.balance ?? 0n); // credit accounts hold negative balances
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

export interface MemberDetailDTO extends MemberDTO {
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
  ledgerAssigned: string;
  ledgerPaid: string;
  ledgerRemaining: string;
  ledgerPct: number;
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
      customerSince: true,
      archivedAt: true,
      treasury: { select: { balance: true } },
      memberships: {
        orderBy: { seq: "desc" },
        select: {
          id: true,
          status: true,
          accounts: { select: { id: true, kind: true, balance: true } },
          loans: { orderBy: { startedAt: "desc" }, select: { id: true, requestedAmount: true, principalOutstanding: true, monthlyRateBps: true, startedAt: true, closedAt: true, status: true } },
          charges: { select: { kind: true, amount: true } },
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
  // proportional share of pooled club profit (same model as the members list)
  const clubProfit = await realizedClubProfit();
  const allDep = await prisma.entry.aggregate({ _sum: { amount: true }, where: { transaction: { type: { in: ["PERIODIC_DEPOSIT", "CATCHUP"] } }, account: { kind: "MEMBER_EQUITY", membership: { status: "ACTIVE" } } } });
  const totalActiveDeposits = -(allDep._sum.amount ?? 0n);
  const profit = active && totalActiveDeposits > 0n ? (clubProfit * deposits) / totalActiveDeposits : 0n;

  const pendingCharge = ms ? await outstandingCharge(ms.id, "CATCHUP") : 0n;
  const penaltyCharge = ms ? await outstandingCharge(ms.id, "PENALTY") : 0n;
  const assigned = ms ? (ms.charges.filter((c) => c.kind === "CATCHUP").reduce((s, c) => s + c.amount, 0n)) : 0n;
  const paidDown = assigned - pendingCharge;

  const loans = ms?.loans ?? [];
  const activeLoan = loans.find((l) => l.status === "ACTIVE");
  const currentLoan = activeLoan?.principalOutstanding ?? 0n;
  const loanTaken = loans.reduce((s, l) => s + l.requestedAmount, 0n);
  const loanRepaid = loans.reduce((s, l) => s + (l.requestedAmount - l.principalOutstanding), 0n);
  // interest collected on this member's loans = LOAN_INTEREST cash legs tied to their memberships
  const intPaidAgg = await prisma.entry.aggregate({ _sum: { amount: true }, where: { amount: { gt: 0 }, transaction: { type: "LOAN_INTEREST", membershipId: { in: m.memberships.map((x) => x.id) } } } });
  const interestPaid = intPaidAgg._sum.amount ?? 0n;

  const cycles: LoanCycleDTO[] = loans.map((l, i) => {
    const overdue = l.status === "ACTIVE" && daysBetween(l.startedAt, new Date()) > 150;
    return {
      n: loans.length - i,
      status: l.status === "CLOSED" ? "closed" : overdue ? "overdue" : "active",
      statusLabel: l.status === "CLOSED" ? "Closed" : overdue ? "Overdue" : "Active",
      amt: formatLakh(l.requestedAmount),
      start: monthYear(l.startedAt),
      end: l.closedAt ? monthYear(l.closedAt) : "—",
      rate: String(l.monthlyRateBps / 100),
      days: l.closedAt ? `${daysBetween(l.startedAt, l.closedAt)} days` : `running ${daysBetween(l.startedAt, new Date())} days`,
      interest: formatPaise((l.principalOutstanding * BigInt(l.monthlyRateBps)) / 10000n),
    };
  });

  return {
    id: m.id,
    name: [m.firstName, m.lastName].filter(Boolean).join(" "),
    joined: monthYear(m.customerSince),
    deposits: formatLakh(deposits),
    profit: formatPaise(profit),
    value: active ? formatLakh(value) : "—",
    held: m.treasury ? formatLakh(m.treasury.balance) : null,
    penalty: penaltyCharge > 0n ? formatPaise(penaltyCharge) : null,
    pending: pendingCharge > 0n ? formatPaise(pendingCharge) : null,
    status: memberStatus(active, m.archivedAt),
    tenure: tenure(m.customerSince),
    managing: m.treasury ? formatLakh(m.treasury.balance) : null,
    loanTaken: formatLakh(loanTaken),
    interestDue: formatPaise(currentLoan > 0n ? (currentLoan * BigInt(activeLoan!.monthlyRateBps)) / 10000n : 0n),
    returnsActual: formatPaise(profit),
    fullShare: formatPaise(profit),
    paidRatioPct: assigned > 0n ? Number((paidDown * 100n) / assigned) : 100,
    periodic: formatLakh(deposits),
    catchup: formatPaise(paidDown),
    totalDeposit: formatLakh(deposits),
    ledgerAssigned: formatPaise(assigned),
    ledgerPaid: formatPaise(paidDown),
    ledgerRemaining: formatPaise(pendingCharge),
    ledgerPct: assigned > 0n ? Number((paidDown * 100n) / assigned) : 100,
    hasLoans: loans.length > 0,
    loanRepaid: formatLakh(loanRepaid),
    currentLoan: formatLakh(currentLoan),
    interestGen: formatPaise(interestPaid + (currentLoan > 0n ? (currentLoan * BigInt(activeLoan!.monthlyRateBps)) / 10000n : 0n)),
    interestPaid: formatPaise(interestPaid),
    cycles,
  };
}
