import "server-only";
import { prisma } from "@/server/db";
import { formatPaise, formatLakh } from "@/lib/money";
import { getTransactions } from "./transactions";
import { getMemberFunds, chargeTotals, realizedClubProfit } from "./members";
import { getVendorTotals } from "./vendors";
import { interestOwedTotal } from "./loans";

// Every figure reuses the same definition as the members / loans / vendors pages so the whole app
// stays consistent. Portfolio value follows PRODUCT.md §14.4; profit-per-member mirrors the members
// page (realized pooled profit ÷ members) — see the note in getDashboard on the §11 open question.
async function totals() {
  const [cashA, interestA, activeLoans, funds, vendors, interestPending, profit, catchup, penalty] = await Promise.all([
    prisma.ledgerAccount.aggregate({ _sum: { balance: true }, where: { kind: "TREASURY_CASH" } }),
    prisma.ledgerAccount.aggregate({ _sum: { balance: true }, where: { kind: "INTEREST_INCOME" } }),
    prisma.loan.findMany({ where: { status: "ACTIVE" }, select: { principalOutstanding: true } }),
    getMemberFunds(),
    getVendorTotals(),
    interestOwedTotal(),
    realizedClubProfit(),
    chargeTotals("CATCHUP"),
    chargeTotals("PENALTY"),
  ]);

  const cash = cashA._sum.balance ?? 0n;
  const interestCollected = -(interestA._sum.balance ?? 0n);
  const onLoan = activeLoans.reduce((s, l) => s + l.principalOutstanding, 0n);

  // PRODUCT.md §14.4: current value = cash + loans out + vendor holding (money still out);
  // total portfolio value = current value + pending loan interest + pending member deposits.
  const portfolio = cash + onLoan + vendors.holding + interestPending + funds.pendingTotal;
  const profitPerMember = funds.activeMembers > 0 ? profit / BigInt(funds.activeMembers) : 0n;

  return { cash, onLoan, interestCollected, interestPending, portfolio, profitPerMember, activeLoanCount: activeLoans.length, funds, vendors, catchup, penalty };
}

export interface DashboardData {
  hero: { label: string; value: string; sub: string; accent: boolean }[];
  totalPortfolio: { value: string; change: string };
  groups: { title: string; items: { l: string; v: string }[] }[];
  chart: number[];
  activity: { who: string; what: string; time: string; amt: string; dir: "in" | "out" | "neutral" }[];
}

export async function getDashboard(): Promise<DashboardData> {
  const t = await totals();
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

  const hero = [
    { label: "Portfolio value", value: formatPaise(t.portfolio), sub: "club total", accent: false },
    { label: "Profit per member", value: formatPaise(t.profitPerMember), sub: "realized ÷ members", accent: true },
    { label: "Available cash", value: formatPaise(t.cash), sub: "liquid balance", accent: false },
    { label: "Outstanding loans", value: formatPaise(t.onLoan), sub: plural(t.activeLoanCount, "active loan"), accent: false },
    { label: "Pending deposits", value: formatPaise(t.funds.pendingTotal), sub: `${plural(t.funds.pendingCount, "member")} behind`, accent: false },
  ];

  const groups = [
    { title: "Member funds", items: [
      { l: "Deposits", v: formatPaise(t.funds.activeDeposits) },
      { l: "Members", v: String(t.funds.activeMembers) },
      { l: "Avg. balance", v: formatPaise(t.funds.avgBalance) },
    ] },
    { title: "Loans & interest", items: [
      { l: "Interest collected", v: formatPaise(t.interestCollected) },
      { l: "Interest pending", v: formatPaise(t.interestPending) },
      { l: "Active loans", v: String(t.activeLoanCount) },
    ] },
    { title: "Vendors", items: [
      { l: "Holding", v: formatLakh(t.vendors.holding) },
      { l: "Profit", v: formatLakh(t.vendors.profit) },
      { l: "Obligation", v: formatLakh(t.vendors.obligation) },
    ] },
    { title: "Catch-up", items: [
      { l: "Assigned", v: formatPaise(t.catchup.assigned) },
      { l: "Collected", v: formatPaise(t.catchup.collected) },
      { l: "Pending", v: formatPaise(t.catchup.pending) },
    ] },
    { title: "Penalties", items: [
      { l: "Assigned", v: formatPaise(t.penalty.assigned) },
      { l: "Collected", v: formatPaise(t.penalty.collected) },
      { l: "Pending", v: formatPaise(t.penalty.pending) },
    ] },
    { title: "Cash flow · 30d", items: await cashFlow30d() },
  ];

  const chart = await portfolioSeries();

  const recent = await getTransactions(8);
  const activity = recent.map((r) => {
    const who = r.dir === "out" ? r.to.name : r.from.name;
    return { who, what: labelShort(r.what), time: r.entered, amt: r.amount, dir: r.dir };
  });

  return {
    hero,
    totalPortfolio: { value: formatPaise(t.portfolio), change: `${t.funds.activeMembers} active members` },
    groups,
    chart,
    activity,
  };
}

function labelShort(what: string): string {
  const map: Record<string, string> = {
    "Member paid deposit": "Deposit", "Give a loan": "Loan disbursed", "Record repayment": "Repayment",
    "Collect interest": "Interest", "Vendor return": "Vendor return", "Vendor investment": "Vendor invest",
    "Member leaves (settle up)": "Withdrawal", "Funds transfer": "Funds transfer", "Catch-up payment": "Catch-up",
    "Delayed-payment penalty": "Late penalty", "Chit installment": "Chit installment", "Chit payout": "Chit payout",
  };
  return map[what] ?? what;
}

// Real 12-month portfolio-value sparkline: cumulative member equity at each month-end.
// Equity is a credit balance (entries negative), so portfolio = −Σ(equity entries) to date.
async function portfolioSeries(): Promise<number[]> {
  const rows = await prisma.entry.findMany({
    where: { account: { kind: "MEMBER_EQUITY" } },
    select: { amount: true, transaction: { select: { occurredAt: true } } },
    orderBy: { transaction: { occurredAt: "asc" } },
  });
  const now = new Date();
  // exclusive upper bound per point: first day of the month after each of the last 12 months
  const cutoffs = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 10 + i, 1)));
  const lakhs = (p: bigint) => Number((Number(p) / 100 / 100000).toFixed(1));
  const out: number[] = [];
  let acc = 0n, idx = 0;
  for (const r of rows) {
    while (idx < 12 && r.transaction.occurredAt >= cutoffs[idx]) out.push(lakhs(acc)), idx++;
    acc -= r.amount;
  }
  while (idx < 12) out.push(lakhs(acc)), idx++;
  return out;
}

async function cashFlow30d(): Promise<{ l: string; v: string }[]> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const rows = await prisma.entry.findMany({
    where: { account: { kind: "TREASURY_CASH" }, transaction: { occurredAt: { gte: since }, entries: { none: { accountId: "club-opening" } } } },
    select: { amount: true },
  });
  const inflow = rows.filter((r) => r.amount > 0n).reduce((s, r) => s + r.amount, 0n);
  const outflow = rows.filter((r) => r.amount < 0n).reduce((s, r) => s - r.amount, 0n);
  const net = inflow - outflow;
  return [
    { l: "Inflow", v: formatPaise(inflow) },
    { l: "Outflow", v: formatPaise(outflow) },
    { l: "Net", v: (net >= 0n ? "+" : "−") + formatPaise(net < 0n ? -net : net) },
  ];
}
