import "server-only";
import { prisma } from "@/server/db";
import { formatPaise, formatLakh } from "@/lib/money";
import { getTransactions, type Party } from "./transactions";
import { getMemberFunds, chargeTotals, realizedClubProfit, profitWithdrawnTotal } from "./members";
import { getVendorTotals } from "./vendors";
import { interestOwedTotal, loanConfig, isOverdue } from "./loans";
import { accumulate, buildBuckets, type Range } from "./analytics";
import { DASH_ACTIVITY_WEB } from "@/features/dashboard/data";

// Dashboard trend tabs (data.ts CHART_RANGES) → analytics range keys.
const CHART_RANGE_MAP: Record<string, Range> = { "3M": "3M", "1Y": "1Y", All: "ALL" };

// Every figure reuses the same definition as the members / loans / vendors pages so the whole app
// stays consistent. Portfolio value follows PRODUCT.md §14.4. Profit-per-member is the same
// shareable pool the members page splits (realized net of chit obligation + pending loan interest,
// §11) — here ÷ members as a per-head headline; the members page splits it ∝ deposits paid.
async function totals() {
  const [cashA, interestA, lifetimeLoanA, config, loanCfg, activeLoans, funds, vendors, interestPending, profit, profitWithdrawn, catchup, penalty] = await Promise.all([
    prisma.ledgerAccount.aggregate({ _sum: { balance: true }, where: { kind: "TREASURY_CASH" } }),
    prisma.ledgerAccount.aggregate({ _sum: { balance: true }, where: { kind: "INTEREST_INCOME" } }),
    prisma.entry.aggregate({ _sum: { amount: true }, where: { amount: { gt: 0 }, account: { kind: "LOAN_RECEIVABLE" } } }),
    prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { startedAt: true } }),
    loanConfig(),
    prisma.loan.findMany({ where: { status: "ACTIVE" }, select: { principalOutstanding: true, startedAt: true } }),
    getMemberFunds(),
    getVendorTotals(),
    interestOwedTotal(),
    realizedClubProfit(),
    profitWithdrawnTotal(),
    chargeTotals("CATCHUP"),
    chargeTotals("PENALTY"),
  ]);

  const cash = cashA._sum.balance ?? 0n;
  const interestCollected = -(interestA._sum.balance ?? 0n);
  const lifetimeLoanGiven = lifetimeLoanA._sum.amount ?? 0n;
  const onLoan = activeLoans.reduce((s, l) => s + l.principalOutstanding, 0n);
  const overdueLoanCount = activeLoans.filter((l) => isOverdue(l.startedAt, loanCfg, new Date())).length;

  // PRODUCT.md §14.4: current value = cash + loans out + vendor holding (money still out);
  // total portfolio value = current value + pending loan interest + pending member deposits.
  const currentValue = cash + onLoan + vendors.holding;
  const portfolio = currentValue + interestPending + funds.pendingTotal;
  // Shareable profit (§11): realized (net of chit obligation) + pending loan interest − profit
  // already withdrawn by leavers. A WITHDRAW never debits income, so a leaver's profit lingers in
  // `realized`; subtracting it stops active members from sharing cash that already left the club.
  const currentProfit = profit + interestPending - profitWithdrawn;
  const profitPerMember = funds.activeMembers > 0 ? currentProfit / BigInt(funds.activeMembers) : 0n;
  // Club age in whole months since the club started.
  const start = config?.startedAt ?? new Date();
  const now = new Date();
  const clubAgeMonths = Math.max(0, (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth()));

  // Total member dues outstanding = deposits + catch-up + penalty pending (shown as one hero KPI).
  const pendingAll = funds.pendingTotal + catchup.pending + penalty.pending;

  return {
    pendingAll,
    cash, onLoan, interestCollected, lifetimeLoanGiven, interestPending, currentValue, portfolio,
    currentProfit, profitPerMember, profitWithdrawn, clubAgeMonths, activeLoanCount: activeLoans.length, overdueLoanCount,
    funds, vendors, catchup, penalty,
  };
}

export interface DashboardData {
  hero: { label: string; value: string; sub: string; accent: boolean }[];
  totalPortfolio: { value: string; change: string };
  activeMembers: number;
  clubAgeMonths: number;
  groups: { title: string; items: { l: string; v: string }[] }[];
  chart: Record<string, number[]>; // range key (data.ts CHART_RANGES) → current-value series in ₹ lakhs
  activity: { from: Party; to: Party; what: string; date: string; time: string; amt: string; dir: "in" | "out" | "neutral" }[];
}

export async function getDashboard(): Promise<DashboardData> {
  // The four blocks are independent, so fetch them concurrently instead of in a waterfall.
  const [t, flow, chart, recent] = await Promise.all([
    totals(),
    cashFlow30d(),
    portfolioSeries(),
    getTransactions(DASH_ACTIVITY_WEB),
  ]);
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

  const hero = [
    { label: "Portfolio value", value: formatPaise(t.portfolio), sub: "club total", accent: false },
    { label: "Profit per member", value: formatPaise(t.profitPerMember), sub: "shareable ÷ members", accent: true },
    { label: "Available cash", value: formatPaise(t.cash), sub: "liquid balance", accent: false },
    { label: "Outstanding loans", value: formatPaise(t.onLoan), sub: plural(t.activeLoanCount, "active loan"), accent: false },
    { label: "Pending dues", value: formatPaise(t.pendingAll), sub: `deposits + catch-up + penalty`, accent: false },
  ];

  // Club Passbook — the full §14.4 breakdown (per-treasurer cash lives in Settings; no view toggle).
  // `flow` fetched above alongside the other independent blocks.
  // Each figure appears once. Hero holds the 5 headline KPIs (portfolio, profit/member, cash,
  // outstanding loans, pending dues); the groups drill into what's NOT already on a hero card.
  const groups = [
    { title: "Club snapshot", items: [
      { l: "Active members", v: String(t.funds.activeMembers) },
      { l: "Club age", v: `${t.clubAgeMonths} mo` },
    ] },
    { title: "Member funds", items: [
      { l: "Member deposits", v: formatPaise(t.funds.activeDeposits) },
      { l: "Average balance", v: formatPaise(t.funds.avgBalance) },
      { l: "Deposits pending", v: formatPaise(t.funds.pendingTotal) },
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
    { title: "Loans — lifetime", items: [
      { l: "Total loan given", v: formatPaise(t.lifetimeLoanGiven) },
      { l: "Total interest collected", v: formatPaise(t.interestCollected) },
    ] },
    { title: "Loans — active", items: [
      { l: "Interest pending", v: formatPaise(t.interestPending) },
      { l: "Active / overdue", v: `${t.activeLoanCount} / ${t.overdueLoanCount}` },
    ] },
    { title: "Vendors", items: [
      { l: "Vendor holding", v: formatLakh(t.vendors.holding) },
      { l: "Vendor profit", v: formatLakh(t.vendors.profit) },
      { l: "Chit obligations", v: formatLakh(t.vendors.obligation) },
    ] },
    { title: "Profit summary", items: [
      { l: "Current profit", v: formatPaise(t.currentProfit) },
      { l: "Profit withdrawn", v: formatPaise(t.profitWithdrawn) },
    ] },
    { title: "Cash flow · 30d", items: flow },
  ];

  // `chart` (portfolioSeries) and `recent` (getTransactions) fetched above; web shows the full list,
  // mobile slices to DASH_ACTIVITY_MOBILE (see dashboard.tsx).
  const activity = recent.map((r) => ({
    from: r.from, to: r.to, what: labelShort(r.what), date: r.date, time: r.entered, amt: r.amount, dir: r.dir,
  }));

  return {
    hero,
    totalPortfolio: { value: formatPaise(t.portfolio), change: `${t.funds.activeMembers} active members` },
    activeMembers: t.funds.activeMembers,
    clubAgeMonths: t.clubAgeMonths,
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

// Portfolio-value trend per range tab. Matches the §14.4 "Current value" definition (cash + loans
// outstanding + vendor holdings) — the three asset accounts, accumulated at each bucket cutoff — so
// the line reconciles with the headline (headline adds pending interest + deposits on top).
async function portfolioSeries(): Promise<Record<string, number[]>> {
  const [config, rows] = await Promise.all([
    prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { startedAt: true } }),
    prisma.entry.findMany({
      where: { account: { kind: { in: ["TREASURY_CASH", "LOAN_RECEIVABLE", "VENDOR_RECEIVABLE"] } } },
      select: { amount: true, transaction: { select: { occurredAt: true } } },
      orderBy: { transaction: { occurredAt: "asc" } },
    }),
  ]);
  const started = config?.startedAt ?? new Date();
  const now = new Date();
  const events = rows.map((r) => ({ amount: r.amount, at: r.transaction.occurredAt }));
  const lakhs = (p: bigint) => Number((Number(p) / 100 / 100000).toFixed(1));

  const out: Record<string, number[]> = {};
  for (const [tab, range] of Object.entries(CHART_RANGE_MAP)) {
    const { cutoffs } = buildBuckets(range, started, now);
    out[tab] = accumulate(events, cutoffs, 1n).map(lakhs);
  }
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
