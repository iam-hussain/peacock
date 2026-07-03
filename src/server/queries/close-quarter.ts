import "server-only";
import { prisma } from "@/server/db";
import { quarterBounds } from "@/lib/quarter";
import { formatPaise } from "@/lib/money";
import { monthYear } from "@/lib/date";

/** Raw club figures at a point in time — reused by the close action (authoritative) and preview. */
export async function quarterFigures(start: Date, end: Date) {
  const [equity, cash, activeMembers, income] = await Promise.all([
    prisma.ledgerAccount.aggregate({ _sum: { balance: true }, where: { kind: "MEMBER_EQUITY" } }),
    prisma.ledgerAccount.aggregate({ _sum: { balance: true }, where: { kind: "TREASURY_CASH" } }),
    prisma.membership.count({ where: { status: "ACTIVE" } }),
    prisma.entry.aggregate({
      _sum: { amount: true },
      where: { account: { kind: { in: ["INTEREST_INCOME", "VENDOR_PROFIT", "OTHER_INCOME"] } }, transaction: { occurredAt: { gte: start, lte: end } } },
    }),
  ]);
  // credit accounts hold negative balances → negate for a positive club figure
  return {
    portfolioPaise: -(equity._sum.balance ?? 0n), // club net worth (members' total equity)
    availableCashPaise: cash._sum.balance ?? 0n,
    netProfitPaise: -(income._sum.amount ?? 0n), // income credited within the quarter
    activeMembers,
  };
}

export interface QuarterPreview {
  label: string;
  period: string;
  activeMembers: number;
  netProfit: string;
  availableCash: string;
  portfolio: string;
  alreadyClosed: boolean;
}

/** Formatted preview shown in the Close-quarter confirm dialog. */
export async function getQuarterPreview(): Promise<QuarterPreview> {
  const cfg = await prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { fyStartMonth: true } });
  const { start, end, label } = quarterBounds(new Date(), cfg?.fyStartMonth ?? 4);
  const [closed, f] = await Promise.all([
    prisma.periodClose.findUnique({ where: { periodStart: start }, select: { id: true } }),
    quarterFigures(start, end),
  ]);
  return {
    label,
    period: `${monthYear(start)} – ${monthYear(end)}`,
    activeMembers: f.activeMembers,
    netProfit: formatPaise(f.netProfitPaise),
    availableCash: formatPaise(f.availableCashPaise),
    portfolio: formatPaise(f.portfolioPaise),
    alreadyClosed: !!closed,
  };
}
