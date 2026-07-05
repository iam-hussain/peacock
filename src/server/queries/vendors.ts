import "server-only";
import { prisma } from "@/server/db";
import { formatLakh, formatPaise } from "@/lib/money";
import { monthYear, dayMonthYear } from "@/lib/date";
import { initials } from "@/lib/avatar";
import type { Status } from "@/components/shared/status-badge";

export type VendorTypeKey = "general" | "chit";

export interface VendorDTO {
  id: string;
  name: string;
  ini: string;
  type: VendorTypeKey;
  typeLabel: string;
  category: string;
  status: Status;
  statusLabel: string;
  cycle: string;
  invested: string;
  roi: string;
  roiPositive: boolean;
  profit: string; // realized profit − chit obligation still owed (PRODUCT.md §11)
  obligation: string | null; // chit installments still owed; null when none
}

function pct(profit: bigint, invested: bigint): string {
  if (invested === 0n) return "0%";
  const p = (Number(profit) / Number(invested)) * 100;
  return `${p >= 0 ? "+" : "−"}${Math.abs(p).toFixed(1)}%`;
}

// A chit's lifecycle is DERIVED from the ledger, not the stored ChitStatus flag: postings never
// advance that flag (see `chitLedger` note below), so a fully-paid chit would otherwise read
// "Running" forever. Completed once every installment is paid; Paid out once the payout is taken.
interface ChitLifecycle { paidCount: number; durationMonths: number; taken: boolean }

// Vendor status → badge tone + label. Chits show their own lifecycle (Running/Paid out/Completed).
function vendorStatus(v: { type: "GENERAL" | "CHIT"; status: string }, chit?: ChitLifecycle): { status: Status; label: string } {
  if (v.type === "CHIT") {
    if (chit && chit.paidCount >= chit.durationMonths) return { status: "settled", label: "Completed" };
    // Paid out but not yet fully paid → still an active chit (installments continue): green, not settled.
    if (chit?.taken) return { status: "active", label: "Paid out" };
    return { status: "active", label: "Running" };
  }
  if (v.status === "CLOSED") return { status: "settled", label: "Closed" };
  if (v.status === "INACTIVE") return { status: "inactive", label: "Inactive" };
  return { status: "active", label: "Active" };
}

function toDTO(
  v: { id: string; name: string; type: "GENERAL" | "CHIT"; category: string | null; status: string; startedAt: Date; chit: { durationMonths: number } | null },
  invested: bigint,
  profit: bigint, // net: realized − obligation
  obligation: bigint = 0n,
  chitLifecycle?: ChitLifecycle,
): VendorDTO {
  const isChit = v.type === "CHIT";
  const { status, label: statusLabel } = vendorStatus(v, chitLifecycle);
  return {
    id: v.id,
    name: v.name,
    ini: initials(v.name),
    type: isChit ? "chit" : "general",
    typeLabel: isChit ? "CHIT" : (v.category ?? "General").toUpperCase(),
    category: v.category ?? (isChit ? "Chit" : "General"),
    status,
    statusLabel,
    cycle: isChit ? `${v.chit?.durationMonths ?? 0}-month chit` : `since ${monthYear(v.startedAt)}`,
    invested: formatLakh(invested),
    roi: pct(profit, invested),
    roiPositive: profit >= 0n,
    profit: (profit >= 0n ? "+" : "−") + formatPaise(profit < 0n ? -profit : profit),
    obligation: obligation > 0n ? formatPaise(obligation) : null,
  };
}

export interface ChitStats {
  paidCount: number; totalPaid: bigint; payout: bigint; taken: boolean; payoutAt: Date | null;
  payoutMonth: number; obligation: bigint; paidInstallments: { date: Date; amt: bigint }[];
}

/**
 * Chit economics derived from the ACTUAL ledger (the ChitFund payout fields aren't
 * populated by postings). Obligation left = remaining months × margin (installments the
 * club must still pay); it reduces realized profit per PRODUCT.md §11.
 */
const CHIT_LEDGER_TYPES = ["CHIT_PAYMENT", "VENDOR_INVEST", "CHIT_PAYOUT", "VENDOR_RETURN"] as const;
type ChitLedgerTxn = { type: string; occurredAt: Date; entries: { amount: bigint }[] };

/** Pure chit economics from already-fetched (TREASURY_CASH-filtered) txns — see `chitLedger`. */
function chitStatsFrom(txns: ChitLedgerTxn[], chit: { durationMonths: number; marginInstallment: bigint }): ChitStats {
  const absAmt = (t: ChitLedgerTxn) => t.entries.reduce((s, e) => s + (e.amount < 0n ? -e.amount : e.amount), 0n);
  const paidInstallments = txns.filter((t) => t.type === "CHIT_PAYMENT" || t.type === "VENDOR_INVEST").map((t) => ({ date: t.occurredAt, amt: absAmt(t) }));
  const payouts = txns.filter((t) => t.type === "CHIT_PAYOUT" || t.type === "VENDOR_RETURN");
  const paidCount = paidInstallments.length;
  const totalPaid = paidInstallments.reduce((s, i) => s + i.amt, 0n);
  const payout = payouts.reduce((s, t) => s + absAmt(t), 0n);
  const payoutAt = payouts[0]?.occurredAt ?? null;
  const taken = payout > 0n;
  const payoutMonth = taken && payoutAt ? paidInstallments.filter((i) => i.date <= payoutAt).length : 0;
  const remaining = Math.max(0, chit.durationMonths - paidCount);
  const obligation = chit.marginInstallment * BigInt(remaining);
  return { paidCount, totalPaid, payout, taken, payoutAt, payoutMonth, obligation, paidInstallments };
}

export async function chitLedger(vendorId: string, chit: { chitValue: bigint; durationMonths: number; marginInstallment: bigint }): Promise<ChitStats> {
  const txns = await prisma.transaction.findMany({
    where: { vendorId, type: { in: [...CHIT_LEDGER_TYPES] } },
    orderBy: { occurredAt: "asc" },
    select: { type: true, occurredAt: true, entries: { where: { account: { kind: "TREASURY_CASH" } }, select: { amount: true } } },
  });
  return chitStatsFrom(txns, chit);
}

/** Batched chit ledgers: one query for every chit vendor's TREASURY_CASH txns, grouped by vendor. */
async function chitTxnsByVendor(vendorIds: string[]): Promise<Map<string, ChitLedgerTxn[]>> {
  const map = new Map<string, ChitLedgerTxn[]>();
  if (!vendorIds.length) return map;
  const txns = await prisma.transaction.findMany({
    where: { vendorId: { in: vendorIds }, type: { in: [...CHIT_LEDGER_TYPES] } },
    orderBy: { occurredAt: "asc" },
    select: { vendorId: true, type: true, occurredAt: true, entries: { where: { account: { kind: "TREASURY_CASH" } }, select: { amount: true } } },
  });
  for (const t of txns) {
    if (!t.vendorId) continue;
    const arr = map.get(t.vendorId) ?? [];
    arr.push(t);
    map.set(t.vendorId, arr);
  }
  return map;
}

// Vendor economics come straight from the ledger (chit-aware projections replaced by realized
// truth once the transform fix landed): VENDOR_RECEIVABLE balance = current holding (money still
// out); VENDOR_PROFIT = realized profit; lifetime invested = Σ positive receivable entries.
const holdingOf = (accounts: { kind: string; balance: bigint }[]) => accounts.find((a) => a.kind === "VENDOR_RECEIVABLE")?.balance ?? 0n;
const profitOf = (accounts: { kind: string; balance: bigint }[]) => -(accounts.find((a) => a.kind === "VENDOR_PROFIT")?.balance ?? 0n);

async function lifetimeInvested(vendorId: string): Promise<bigint> {
  const r = await prisma.entry.aggregate({ _sum: { amount: true }, where: { amount: { gt: 0 }, account: { kind: "VENDOR_RECEIVABLE", vendorId } } });
  return r._sum.amount ?? 0n;
}

const CHIT_TERMS = { select: { chitValue: true, durationMonths: true, marginInstallment: true } } as const;

type ChitFin = { profit: bigint; obligation: bigint };

// Chit P/L (PRODUCT.md §10/§11): eventual receipt − everything paid or still owed.
//   receipt   = payout if taken, else the chit's face value (still to be received)
//   obligation = installments still owed = margin × months not yet paid (0 once fully covered)
// A general vendor has no obligation; its profit is the realized VENDOR_PROFIT.
type VendorFinInput = { id: string; type: string; accounts: { kind: string; balance: bigint }[]; chit: { chitValue: bigint; durationMonths: number; marginInstallment: bigint } | null };

/** Vendor P/L from precomputed chit stats (null → general vendor: realized VENDOR_PROFIT only). */
function finFromStats(v: VendorFinInput, s: ChitStats | null): ChitFin {
  if (v.type !== "CHIT" || !v.chit || !s) return { profit: profitOf(v.accounts), obligation: 0n };
  const receipt = s.taken ? s.payout : v.chit.chitValue;
  return { profit: receipt - (s.totalPaid + s.obligation), obligation: s.obligation };
}

/** Club-wide vendor profit (chit P/L + general realized) and chit obligation still owed (paise). */
export async function vendorProfitAndObligation(): Promise<ChitFin> {
  const vendors = await prisma.vendor.findMany({ select: { id: true, type: true, accounts: { select: { kind: true, balance: true } }, chit: CHIT_TERMS } });
  const byVendor = await chitTxnsByVendor(vendors.filter((v) => v.type === "CHIT" && v.chit).map((v) => v.id));
  const fins = vendors.map((v) => finFromStats(v, v.type === "CHIT" && v.chit ? chitStatsFrom(byVendor.get(v.id) ?? [], v.chit) : null));
  return { profit: fins.reduce((s, f) => s + f.profit, 0n), obligation: fins.reduce((s, f) => s + f.obligation, 0n) };
}

const LIST_SELECT = {
  id: true, name: true, type: true, category: true, status: true, startedAt: true,
  accounts: { select: { id: true, kind: true, balance: true } },
  chit: CHIT_TERMS,
} as const;

// List rows: lifetime invested + P/L (chit projects the face value if no payout yet) + obligation owed.
export async function getVendors(): Promise<VendorDTO[]> {
  const vendors = await prisma.vendor.findMany({ orderBy: { name: "asc" }, select: LIST_SELECT });
  // Lifetime invested for ALL vendors in one grouped query (by receivable account, one per vendor),
  // and every chit vendor's ledger in one batched query — instead of 2 queries per vendor.
  const [investedGroups, chitByVendor] = await Promise.all([
    prisma.entry.groupBy({ by: ["accountId"], _sum: { amount: true }, where: { amount: { gt: 0 }, account: { kind: "VENDOR_RECEIVABLE", vendorId: { in: vendors.map((v) => v.id) } } } }),
    chitTxnsByVendor(vendors.filter((v) => v.type === "CHIT" && v.chit).map((v) => v.id)),
  ]);
  const investedByAcct = new Map(investedGroups.map((g) => [g.accountId, g._sum.amount ?? 0n]));
  return vendors.map((v) => {
    const recvId = v.accounts.find((a) => a.kind === "VENDOR_RECEIVABLE")?.id;
    const invested = recvId ? investedByAcct.get(recvId) ?? 0n : 0n;
    const s = v.type === "CHIT" && v.chit ? chitStatsFrom(chitByVendor.get(v.id) ?? [], v.chit) : null;
    const fin = finFromStats(v, s);
    const lifecycle = v.chit && s ? { paidCount: s.paidCount, durationMonths: v.chit.durationMonths, taken: s.taken } : undefined;
    return toDTO(v, invested, fin.profit, fin.obligation, lifecycle);
  });
}

// Club-wide vendor position: holding (money still out), P/L, obligation owed, ROI on lifetime invested.
export async function getVendorTotals(): Promise<{ holding: bigint; invested: bigint; obligation: bigint; profit: bigint; roi: number }> {
  const [holdingA, investedA, fin] = await Promise.all([
    prisma.ledgerAccount.aggregate({ _sum: { balance: true }, where: { kind: "VENDOR_RECEIVABLE" } }),
    prisma.entry.aggregate({ _sum: { amount: true }, where: { amount: { gt: 0 }, account: { kind: "VENDOR_RECEIVABLE" } } }),
    vendorProfitAndObligation(),
  ]);
  const holding = holdingA._sum.balance ?? 0n;
  const invested = investedA._sum.amount ?? 0n;
  return { holding, invested, obligation: fin.obligation, profit: fin.profit, roi: invested > 0n ? (Number(fin.profit) / Number(invested)) * 100 : 0 };
}

export async function getVendorStats(): Promise<{ label: string; value: string; tone?: "in" | "teal" }[]> {
  const { holding, profit, obligation } = await getVendorTotals();
  return [
    { label: "Holding", value: formatLakh(holding) },
    { label: "Profit", value: formatLakh(profit), tone: "in" },
    { label: "Obligation", value: formatLakh(obligation) },
  ];
}

// ---------------- details ----------------
export interface ChitDetailDTO extends VendorDTO {
  start: string; months: number; paidCount: number; valueDisp: string; marginDisp: string;
  valueRupees: number; marginRupees: number; // raw, for prefilling the edit form
  totalPaidDisp: string; obligationDisp: string; payoutDisp: string; taken: boolean; payoutMonth: number;
  installments: { n: number; isPayout: boolean; lbl: string; amt: string; paid: boolean }[];
}
export interface GeneralDetailDTO extends VendorDTO {
  placed: string; investedDisp: string; returnsDisp: string; currentDisp: string; lastReturn: string;
  history: { month: string; amt: string }[];
}

async function loadVendor(id: string) {
  return prisma.vendor.findUnique({
    where: { id },
    select: { id: true, name: true, type: true, category: true, status: true, startedAt: true, accounts: { select: { id: true, kind: true, balance: true } }, chit: true },
  });
}

export async function getChitDetail(id: string): Promise<ChitDetailDTO | null> {
  const v = await loadVendor(id);
  if (!v || v.type !== "CHIT" || !v.chit) return null;
  const c = v.chit;
  const months = c.durationMonths;
  const margin = c.marginInstallment;
  const s = await chitLedger(id, c);
  const { paidCount, totalPaid, payout, taken, payoutMonth, obligation, paidInstallments } = s;
  // Summary P/L = eventual receipt (payout if taken, else face value) − (paid to date + obligation).
  const receipt = taken ? payout : c.chitValue;
  const base = toDTO(v, await lifetimeInvested(id), receipt - (totalPaid + obligation), obligation, { paidCount, durationMonths: months, taken });

  return {
    ...base,
    start: monthYear(c.startedAt),
    months,
    paidCount,
    valueDisp: formatPaise(c.chitValue),
    marginDisp: formatPaise(margin),
    valueRupees: Number(c.chitValue) / 100,
    marginRupees: Number(margin) / 100,
    totalPaidDisp: formatPaise(totalPaid),
    obligationDisp: formatPaise(obligation),
    payoutDisp: formatPaise(payout),
    taken,
    payoutMonth,
    installments: Array.from({ length: Math.max(months, paidCount) }, (_, i) => {
      const n = i + 1;
      const real = paidInstallments[i];
      return { n, isPayout: n === payoutMonth, lbl: real ? "paid" : "due", amt: formatPaise(real ? real.amt : margin), paid: !!real };
    }),
  };
}

export async function getGeneralDetail(id: string): Promise<GeneralDetailDTO | null> {
  const v = await loadVendor(id);
  if (!v || v.type !== "GENERAL") return null;
  const invested = await lifetimeInvested(id);
  const holding = holdingOf(v.accounts);
  const profit = profitOf(v.accounts);
  const base = toDTO({ ...v, chit: null }, invested, profit);
  const returns = await prisma.transaction.findMany({
    // Hide opening-balance reconciliation rows, but KEEP null-description returns: in SQL
    // `NOT (description LIKE '%opening%')` is NULL (→ excluded) for a null description, so the
    // opening filter must explicitly allow nulls or every real un-described return vanishes.
    where: { vendorId: id, type: "VENDOR_RETURN", OR: [{ description: null }, { description: { not: { contains: "opening" } } }] },
    orderBy: { occurredAt: "desc" },
    take: 6,
    select: { occurredAt: true, entries: { where: { account: { kind: "TREASURY_CASH" } }, select: { amount: true } } },
  });
  return {
    ...base,
    placed: monthYear(v.startedAt),
    investedDisp: formatLakh(invested),
    returnsDisp: formatPaise(profit),
    currentDisp: formatLakh(holding),
    lastReturn: returns[0] ? dayMonthYear(returns[0].occurredAt) : "—",
    history: returns.map((r) => ({ month: monthYear(r.occurredAt), amt: formatPaise(r.entries.reduce((s, e) => s + e.amount, 0n)) })),
  };
}
