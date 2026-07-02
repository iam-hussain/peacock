import "server-only";
import { prisma } from "@/server/db";
import { formatLakh, formatPaise } from "@/lib/money";
import { monthYear, dayMonthYear, daysBetween } from "@/lib/date";
import type { Status } from "@/components/shared/status-badge";

const TERM_DAYS = 150; // 5-month term
const rateLabel = (bps: number) => `${bps / 100}% / mo`;
const interestOf = (principal: bigint, bps: number) => (principal * BigInt(bps)) / 10000n;

export type LoanStatusKey = "active" | "overdue" | "closed";

export interface LoanDTO {
  id: string;
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
      membership: { select: { member: { select: { firstName: true, lastName: true } } } },
    },
  });
}

function toDTO(l: Awaited<ReturnType<typeof loanRows>>[number], tranches: number): LoanDTO {
  const name = [l.membership.member.firstName, l.membership.member.lastName].filter(Boolean).join(" ");
  const days = daysBetween(l.startedAt, l.closedAt ?? new Date());
  const overdue = l.status === "ACTIVE" && days > TERM_DAYS;
  const key: LoanStatusKey = l.status === "CLOSED" ? "closed" : overdue ? "overdue" : "active";
  const repaid = l.requestedAmount - l.principalOutstanding;
  const pct = l.requestedAmount > 0n ? Number((repaid * 100n) / l.requestedAmount) : 0;
  if (key === "closed") {
    return {
      id: l.id, member: name, status: key, statusLabel: "Closed", badge: "settled", amount: formatLakh(l.requestedAmount), open: false,
      closedDate: monthYear(l.closedAt ?? l.startedAt), ran: `ran ${days} days`, interestEarned: formatPaise(interestOf(l.requestedAmount, l.monthlyRateBps)),
    };
  }
  return {
    id: l.id, member: name, status: key, statusLabel: overdue ? "Overdue" : "Active", badge: overdue ? "left" : "active",
    amount: formatLakh(l.requestedAmount), open: true, start: monthYear(l.startedAt),
    elapsed: overdue ? `overdue ${days - TERM_DAYS} days` : `${days} days`, overdue,
    pct, pending: formatLakh(l.principalOutstanding), rate: rateLabel(l.monthlyRateBps), tranches,
  };
}

async function trancheCount(loanId: string): Promise<number> {
  return prisma.transaction.count({ where: { loanId, type: "LOAN_TAKEN" } });
}

export async function getLoans(): Promise<LoanDTO[]> {
  const rows = await loanRows();
  return Promise.all(rows.map(async (l) => toDTO(l, await trancheCount(l.id))));
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

export async function getLoanIds(): Promise<string[]> {
  const rows = await prisma.loan.findMany({ select: { id: true } });
  return rows.map((r) => r.id);
}

// ---------------- detail ----------------
export interface LoanDetailDTO extends LoanDTO {
  termLabel: string;
  rateDisp: string;
  interestToDate: string;
  interestCollected: string;
  trancheList: { amt: string; by: string; date: string }[];
}

export async function getLoanDetail(id: string): Promise<LoanDetailDTO | null> {
  const rows = await loanRows();
  const l = rows.find((r) => r.id === id);
  if (!l) return null;
  const base = toDTO(l, await trancheCount(id));

  const tranches = await prisma.transaction.findMany({
    where: { loanId: id, type: "LOAN_TAKEN" },
    orderBy: { occurredAt: "asc" },
    select: { occurredAt: true, entries: { where: { account: { kind: "LOAN_RECEIVABLE" } }, select: { amount: true } } },
  });
  // resolve who disbursed (the debited treasury's owner) per tranche
  const trancheList = await Promise.all(
    tranches.map(async (t) => {
      const amt = t.entries.reduce((s, e) => s + e.amount, 0n);
      const treasuryLeg = await prisma.entry.findFirst({
        where: { transaction: { loanId: id, occurredAt: t.occurredAt, type: "LOAN_TAKEN" }, account: { kind: "TREASURY_CASH" } },
        select: { account: { select: { member: { select: { firstName: true, lastName: true } } } } },
      });
      const by = treasuryLeg?.account.member ? [treasuryLeg.account.member.firstName, treasuryLeg.account.member.lastName].filter(Boolean).join(" ") : "—";
      return { amt: formatLakh(amt), by, date: dayMonthYear(t.occurredAt) };
    }),
  );

  const collected = await prisma.entry.aggregate({ _sum: { amount: true }, where: { amount: { gt: 0 }, transaction: { loanId: id, type: "LOAN_INTEREST" } } });
  return {
    ...base,
    termLabel: "5 months",
    rateDisp: rateLabel(l.monthlyRateBps),
    interestToDate: formatPaise(interestOf(l.principalOutstanding, l.monthlyRateBps)),
    interestCollected: formatPaise(collected._sum.amount ?? 0n),
    pending: base.pending ?? formatLakh(l.principalOutstanding),
    pct: base.pct ?? 100,
    tranches: base.tranches ?? trancheList.length,
    trancheList,
  };
}
