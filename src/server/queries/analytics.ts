import "server-only";
import { Prisma, type LedgerAccountKind } from "@prisma/client";
import { prisma } from "@/server/db";
import { formatPaise, formatLakh } from "@/lib/money";

// The analytics page is a metric × time-range explorer (PRODUCT.md §11, IMPLEMENTATION_PLAN §19).
// Every series here is computed honestly from the ledger at each time-bucket cutoff — a single
// entry scan accumulated across cutoffs (the same technique as dashboard.portfolioSeries).
//
// ponytail: only the cheaply-computable STOCK / cumulative-FLOW / COUNT metrics live here. The
// derived-as-of metrics that need per-loan interest recompute at every historical point (Interest
// Pending, Current Profit, Member/Catch-up Pending — §19) are deliberately omitted until a
// MonthlyRollup cache exists; they'd cost an interestToDate() pass per bucket. Add them there.

export const AN_RANGES = ["1M", "3M", "6M", "1Y", "ALL"] as const;
export type Range = (typeof AN_RANGES)[number];

// label → how to build its series. Keep the label set in sync with data.ts AN_METRIC_GROUPS.
// A money metric sums signed entries matching `where` (sign flips credit accounts positive);
// `members` counts active memberships as-of each cutoff.
// `byType` marks a metric filtered by transaction.type (not just account kind). Those must exclude
// reversed originals — the negating REVERSAL leg carries type=REVERSAL so the type filter hides it,
// and the original would otherwise keep counting after a delete/edit. Account-kind-only metrics need
// no such filter: they already see the reversal leg (same account) and net out on their own.
type MetricDef =
  | { kind: "money"; where: Prisma.EntryWhereInput; sign: bigint; breakdown?: "treasurer" | "vendor"; byType?: true }
  | { kind: "count"; source: "members" }
  | { kind: "vendorProfit" }; // chit-aware P/L — matches the vendor page (see vendorProfitSeries)

const K = (kind: LedgerAccountKind): Prisma.EntryWhereInput => ({ account: { is: { kind } } });

const METRICS: Record<string, MetricDef> = {
  "Total Portfolio Value": { kind: "money", where: K("MEMBER_EQUITY"), sign: -1n },
  "Available Cash": { kind: "money", where: K("TREASURY_CASH"), sign: 1n, breakdown: "treasurer" },
  "Member Deposits": { kind: "money", where: { account: { is: { kind: "MEMBER_EQUITY" } }, transaction: { is: { type: "PERIODIC_DEPOSIT" } } }, sign: -1n, byType: true },
  "Active Members": { kind: "count", source: "members" },
  "Current Loan Taken": { kind: "money", where: K("LOAN_RECEIVABLE"), sign: 1n },
  "Total Loan Given": { kind: "money", where: { account: { is: { kind: "LOAN_RECEIVABLE" } }, transaction: { is: { type: "LOAN_TAKEN" } } }, sign: 1n, byType: true },
  "Total Interest Collected": { kind: "money", where: K("INTEREST_INCOME"), sign: -1n },
  "Vendor Investment": { kind: "money", where: K("VENDOR_RECEIVABLE"), sign: 1n, breakdown: "vendor" },
  "Vendor Profit": { kind: "vendorProfit" },
};

export const AN_METRIC_LABELS = Object.keys(METRICS);
export const isMetric = (m: string): boolean => m in METRICS;

export interface GraphSeries {
  metric: string;
  unit: "money" | "count";
  points: number[]; // display units: money → ₹ lakhs, count → raw
  labels: string[]; // x-axis labels, aligned to points
  hero: { value: string; changeArrow: string; changePct: string; changeAbs: string; caption: string; positive: boolean };
  stats: { high: string; low: string; avg: string } | null; // money only
  breakdown: { title: string; rows: { name: string; disp: string; pct: number }[] } | null;
}

export async function getGraphSeries(metric: string, range: Range): Promise<GraphSeries> {
  const def = METRICS[metric] ?? METRICS["Total Portfolio Value"];
  const label = def === METRICS[metric] ? metric : "Total Portfolio Value";
  const config = await prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { startedAt: true } });
  const { cutoffs, labels } = buildBuckets(range, config?.startedAt ?? new Date(), new Date());

  if (def.kind === "count") {
    const memberships = await prisma.membership.findMany({ select: { joinedAt: true, leftAt: true } });
    const raw = cutoffs.map((c) => BigInt(memberships.filter((m) => m.joinedAt < c && (m.leftAt == null || m.leftAt >= c)).length));
    return assemble(label, "count", raw, labels, range, null);
  }

  if (def.kind === "vendorProfit") {
    const { raw, breakdown } = await vendorProfitSeries(cutoffs);
    return assemble(label, "money", raw, labels, range, breakdown);
  }

  const baseIs = {
    ...((def.where.transaction as { is?: Prisma.TransactionWhereInput } | undefined)?.is ?? {}),
    ...(def.byType ? { reversed: false as const } : {}),
  };
  const withTxn = (extra: Prisma.TransactionWhereInput): Prisma.EntryWhereInput => {
    const is = { ...baseIs, ...extra };
    return Object.keys(is).length ? { ...def.where, transaction: { is } } : def.where;
  };
  // Bounded window scan: only entries at/after the first cutoff are fetched (and in-memory
  // relation-sorted); everything before it folds into ONE aggregate `opening` balance — so a
  // "1M" series stops scanning the club's whole history. ALL has no lower bound by definition.
  const first = cutoffs[0];
  const [openingAgg, rows] = await Promise.all([
    range === "ALL"
      ? Promise.resolve(null)
      : prisma.entry.aggregate({ _sum: { amount: true }, where: withTxn({ occurredAt: { lt: first } }) }),
    prisma.entry.findMany({
      where: range === "ALL" ? withTxn({}) : withTxn({ occurredAt: { gte: first } }),
      select: { amount: true, transaction: { select: { occurredAt: true } } },
      orderBy: { transaction: { occurredAt: "asc" } },
    }),
  ]);
  const opening = def.sign * (openingAgg?._sum.amount ?? 0n);
  const raw = accumulate(rows.map((r) => ({ amount: r.amount, at: r.transaction.occurredAt })), cutoffs, def.sign, opening);
  const breakdown = def.breakdown ? await getBreakdown(def.breakdown) : null;
  return assemble(label, "money", raw, labels, range, breakdown);
}

// ---- series math ----------------------------------------------------------

// Cumulative signed sum of `rows` (sorted asc by `at`) at each exclusive-upper-bound cutoff.
// `opening` folds in everything before the fetched window (see the bounded scan above).
export function accumulate(rows: { amount: bigint; at: Date }[], cutoffs: Date[], sign: bigint, opening = 0n): bigint[] {
  const out: bigint[] = [];
  let acc = opening, idx = 0;
  for (const r of rows) {
    while (idx < cutoffs.length && r.at >= cutoffs[idx]) { out.push(acc); idx++; }
    acc += sign * r.amount;
  }
  while (idx < cutoffs.length) { out.push(acc); idx++; }
  return out;
}

function assemble(
  metric: string,
  unit: "money" | "count",
  raw: bigint[],
  labels: string[],
  range: Range,
  breakdown: GraphSeries["breakdown"],
): GraphSeries {
  const first = raw[0] ?? 0n;
  const last = raw[raw.length - 1] ?? 0n;
  const delta = last - first;
  const positive = delta >= 0n;
  const caption = range === "ALL" ? "all time" : `this ${range}`;
  // % is meaningless off a zero/near-zero baseline (e.g. ALL starts at the club's opening month when
  // the portfolio was ~₹0, which would read as +12466%). Show a dash when the start is under 1% of
  // the end — the absolute change still tells the story. Uses last (not delta) so a decline still shows %.
  const negligibleBase = first === 0n || Math.abs(Number(first)) * 100 < Math.abs(Number(last));
  const pct = negligibleBase ? "—" : `${(Math.abs(Number(delta)) / Math.abs(Number(first)) * 100).toFixed(unit === "money" ? 1 : 0)}%`;

  const points = raw.map((p) => (unit === "money" ? Number((Number(p) / 100 / 100000).toFixed(2)) : Number(p)));

  const hero = {
    value: unit === "money" ? formatPaise(last) : String(last),
    changeArrow: positive ? "↑" : "↓",
    changePct: pct,
    changeAbs: (positive ? "+" : "−") + (unit === "money" ? formatPaise(delta < 0n ? -delta : delta) : String(delta < 0n ? -delta : delta)),
    caption,
    positive,
  };

  const stats =
    unit === "money"
      ? {
          high: formatLakh(raw.reduce((m, p) => (p > m ? p : m), raw[0] ?? 0n)),
          low: formatLakh(raw.reduce((m, p) => (p < m ? p : m), raw[0] ?? 0n)),
          avg: formatLakh(raw.reduce((s, p) => s + p, 0n) / BigInt(raw.length || 1)),
        }
      : null;

  return { metric, unit, points, labels, hero, stats, breakdown };
}

// ---- time buckets ---------------------------------------------------------

// Exclusive upper-bound cutoffs + x labels for a range. Spacing per §19: 1M daily · 3M/6M weekly ·
// 1Y/ALL monthly. ponytail: bucketed in UTC to match dashboard.portfolioSeries; IST edge-of-day
// drift is immaterial at month/week grain. Tighten if 1M daily ever needs IST-exact boundaries.
export function buildBuckets(range: Range, startedAt: Date, now: Date): { cutoffs: Date[]; labels: string[] } {
  const y = now.getUTCFullYear(), mo = now.getUTCMonth(), d = now.getUTCDate();
  const dayFmt = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
  const monFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

  if (range === "1M" || range === "3M" || range === "6M") {
    const count = range === "1M" ? 30 : range === "3M" ? 13 : 26;
    const stepDays = range === "1M" ? 1 : 7;
    const cutoffs: Date[] = [];
    const labels: string[] = [];
    for (let i = 0; i < count; i++) {
      const back = (count - 1 - i) * stepDays;
      const day = new Date(Date.UTC(y, mo, d - back));
      cutoffs.push(new Date(Date.UTC(y, mo, d - back + 1))); // midnight after the bucket day
      labels.push(dayFmt.format(day));
    }
    return { cutoffs, labels };
  }

  // monthly: 1Y = last 12 months; ALL = club start → now (min 2 points)
  const startMonths = range === "1Y" ? 11 : Math.max(1, (y - startedAt.getUTCFullYear()) * 12 + (mo - startedAt.getUTCMonth()));
  const cutoffs: Date[] = [];
  const labels: string[] = [];
  for (let i = 0; i <= startMonths; i++) {
    const monthStart = new Date(Date.UTC(y, mo - startMonths + i, 1));
    cutoffs.push(new Date(Date.UTC(y, mo - startMonths + i + 1, 1))); // first day of the NEXT month
    labels.push(monFmt.format(monthStart));
  }
  return { cutoffs, labels };
}

// ---- vendor profit (chit-aware, as-of) ------------------------------------

// Vendor Profit must match the vendor page (queries/vendors.ts vendorFin): a GENERAL vendor's profit
// is realized −VENDOR_PROFIT; a CHIT vendor's is receipt − paid − obligation, where receipt is the
// payout once taken else the projected face value, and obligation is the margin on months not yet
// paid. Here it's evaluated as-of every cutoff so the trend (and its endpoint = the vendor page) are
// consistent. Bounded (few vendors × ≤72 buckets) — fine to run live.
async function vendorProfitSeries(cutoffs: Date[]): Promise<{ raw: bigint[]; breakdown: GraphSeries["breakdown"] }> {
  const vendors = await prisma.vendor.findMany({
    select: { id: true, name: true, type: true, chit: { select: { chitValue: true, durationMonths: true, marginInstallment: true } } },
  });

  const totals = cutoffs.map(() => 0n);
  const rows: { name: string; bal: bigint }[] = [];

  const generalIds = vendors.filter((v) => v.type !== "CHIT" || !v.chit).map((v) => v.id);
  const chitIds = vendors.filter((v) => v.type === "CHIT" && v.chit).map((v) => v.id);

  // Two batched queries (vs two per vendor): all VENDOR_PROFIT entries for the general vendors, and
  // all cash-side txns for the chit vendors. Grouped by vendorId in JS below.
  const [profitEntries, chitTxns] = await Promise.all([
    generalIds.length
      ? prisma.entry.findMany({
          where: { account: { is: { kind: "VENDOR_PROFIT", vendorId: { in: generalIds } } } },
          select: { amount: true, account: { select: { vendorId: true } }, transaction: { select: { occurredAt: true } } },
          orderBy: { transaction: { occurredAt: "asc" } },
        })
      : Promise.resolve([]),
    chitIds.length
      ? prisma.transaction.findMany({
          where: { vendorId: { in: chitIds }, type: { in: ["CHIT_PAYMENT", "VENDOR_INVEST", "CHIT_PAYOUT", "VENDOR_RETURN"] } },
          orderBy: { occurredAt: "asc" },
          select: { vendorId: true, type: true, occurredAt: true, entries: { where: { account: { kind: "TREASURY_CASH" } }, select: { amount: true } } },
        })
      : Promise.resolve([]),
  ]);

  const entriesByVendor = new Map<string, { amount: bigint; at: Date }[]>();
  for (const e of profitEntries) {
    const vid = e.account.vendorId;
    if (!vid) continue;
    (entriesByVendor.get(vid) ?? entriesByVendor.set(vid, []).get(vid)!).push({ amount: e.amount, at: e.transaction.occurredAt });
  }
  const txnsByVendor = new Map<string, typeof chitTxns>();
  for (const t of chitTxns) {
    if (!t.vendorId) continue;
    (txnsByVendor.get(t.vendorId) ?? txnsByVendor.set(t.vendorId, []).get(t.vendorId)!).push(t);
  }

  for (const v of vendors) {
    let arr: bigint[];
    if (v.type !== "CHIT" || !v.chit) {
      arr = accumulate(entriesByVendor.get(v.id) ?? [], cutoffs, -1n);
    } else {
      const chit = v.chit;
      const ev = (txnsByVendor.get(v.id) ?? []).map((t) => ({
        at: t.occurredAt,
        pay: t.type === "CHIT_PAYMENT" || t.type === "VENDOR_INVEST",
        amt: t.entries.reduce((s, e) => s + (e.amount < 0n ? -e.amount : e.amount), 0n),
      }));
      arr = cutoffs.map((c) => {
        const upto = ev.filter((e) => e.at < c);
        const paid = upto.filter((e) => e.pay);
        const totalPaid = paid.reduce((s, e) => s + e.amt, 0n);
        const payout = upto.filter((e) => !e.pay).reduce((s, e) => s + e.amt, 0n);
        const remaining = Math.max(0, chit.durationMonths - paid.length);
        const receipt = payout > 0n ? payout : chit.chitValue;
        return receipt - totalPaid - chit.marginInstallment * BigInt(remaining);
      });
    }
    for (let i = 0; i < cutoffs.length; i++) totals[i] += arr[i];
    rows.push({ name: v.name, bal: arr[arr.length - 1] ?? 0n });
  }

  rows.sort((a, b) => (b.bal > a.bal ? 1 : b.bal < a.bal ? -1 : 0));
  return { raw: totals, breakdown: rowsFrom("By vendor", rows) };
}

// ---- contextual breakdown -------------------------------------------------

async function getBreakdown(kind: "treasurer" | "vendor"): Promise<GraphSeries["breakdown"]> {
  if (kind === "treasurer") {
    const treasurers = await prisma.member.findMany({
      where: { treasury: { some: {} } },
      select: { firstName: true, lastName: true, treasury: { select: { balance: true } } },
    });
    return rowsFrom(
      "By treasurer",
      treasurers
        .map((t) => ({ name: [t.firstName, t.lastName].filter(Boolean).join(" "), bal: t.treasury[0]?.balance ?? 0n }))
        .sort((a, b) => (b.bal > a.bal ? 1 : b.bal < a.bal ? -1 : 0)),
    );
  }
  const vendors = await prisma.ledgerAccount.findMany({
    where: { kind: "VENDOR_RECEIVABLE" },
    select: { balance: true, vendor: { select: { name: true } } },
    orderBy: { balance: "desc" },
  });
  return rowsFrom("By vendor", vendors.map((v) => ({ name: v.vendor?.name ?? "—", bal: v.balance })));
}

function rowsFrom(title: string, items: { name: string; bal: bigint }[]): GraphSeries["breakdown"] {
  const total = items.reduce((s, i) => s + i.bal, 0n);
  return {
    title,
    rows: items.map((i) => ({
      name: i.name,
      disp: formatPaise(i.bal),
      pct: total > 0n ? Math.round((Number(i.bal) / Number(total)) * 100) : 0,
    })),
  };
}
