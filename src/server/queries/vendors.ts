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

function toDTO(
  v: { id: string; name: string; type: "GENERAL" | "CHIT"; category: string | null; status: string; startedAt: Date; chit: { durationMonths: number } | null },
  invested: bigint,
  profit: bigint, // net: realized − obligation
  obligation: bigint = 0n,
): VendorDTO {
  const isChit = v.type === "CHIT";
  const statusLabel = v.status === "CLOSED" ? "Closed" : isChit ? "Running" : "Active";
  return {
    id: v.id,
    name: v.name,
    ini: initials(v.name),
    type: isChit ? "chit" : "general",
    typeLabel: isChit ? "CHIT" : (v.category ?? "General").toUpperCase(),
    category: v.category ?? (isChit ? "Chit" : "General"),
    status: v.status === "CLOSED" ? "settled" : "active",
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
export async function chitLedger(vendorId: string, chit: { chitValue: bigint; durationMonths: number; marginInstallment: bigint }): Promise<ChitStats> {
  const txns = await prisma.transaction.findMany({
    where: { vendorId, type: { in: ["CHIT_PAYMENT", "VENDOR_INVEST", "CHIT_PAYOUT", "VENDOR_RETURN"] } },
    orderBy: { occurredAt: "asc" },
    select: { type: true, occurredAt: true, entries: { where: { account: { kind: "TREASURY_CASH" } }, select: { amount: true } } },
  });
  const absAmt = (t: (typeof txns)[number]) => t.entries.reduce((s, e) => s + (e.amount < 0n ? -e.amount : e.amount), 0n);
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

// Chit obligation = installments still owed (margin × months not yet paid), per PRODUCT.md §10/§11.
// Zero for general vendors and for fully-paid chits ("all months covered"). Reduces profit.
async function vendorObligation(v: { id: string; type: string; chit: { chitValue: bigint; durationMonths: number; marginInstallment: bigint } | null }): Promise<bigint> {
  if (v.type !== "CHIT" || !v.chit) return 0n;
  return (await chitLedger(v.id, v.chit)).obligation;
}

/** Club-wide chit obligation still owed (paise). */
export async function totalChitObligation(): Promise<bigint> {
  const chits = await prisma.vendor.findMany({ where: { type: "CHIT" }, select: { id: true, type: true, chit: CHIT_TERMS } });
  const obs = await Promise.all(chits.map(vendorObligation));
  return obs.reduce((s, o) => s + o, 0n);
}

const LIST_SELECT = {
  id: true, name: true, type: true, category: true, status: true, startedAt: true,
  accounts: { select: { kind: true, balance: true } },
  chit: CHIT_TERMS,
} as const;

// List rows: lifetime invested + net profit (realized − obligation) + the obligation still owed.
export async function getVendors(): Promise<VendorDTO[]> {
  const vendors = await prisma.vendor.findMany({ orderBy: { name: "asc" }, select: LIST_SELECT });
  return Promise.all(vendors.map(async (v) => {
    const [invested, obligation] = await Promise.all([lifetimeInvested(v.id), vendorObligation(v)]);
    return toDTO(v, invested, profitOf(v.accounts) - obligation, obligation);
  }));
}

// Club-wide vendor position: holding (money still out), net profit (realized − obligation),
// the obligation itself, and ROI on lifetime invested.
export async function getVendorTotals(): Promise<{ holding: bigint; invested: bigint; realized: bigint; obligation: bigint; profit: bigint; roi: number }> {
  const [holdingA, profitA, investedA, obligation] = await Promise.all([
    prisma.ledgerAccount.aggregate({ _sum: { balance: true }, where: { kind: "VENDOR_RECEIVABLE" } }),
    prisma.ledgerAccount.aggregate({ _sum: { balance: true }, where: { kind: "VENDOR_PROFIT" } }),
    prisma.entry.aggregate({ _sum: { amount: true }, where: { amount: { gt: 0 }, account: { kind: "VENDOR_RECEIVABLE" } } }),
    totalChitObligation(),
  ]);
  const holding = holdingA._sum.balance ?? 0n;
  const realized = -(profitA._sum.balance ?? 0n);
  const invested = investedA._sum.amount ?? 0n;
  const profit = realized - obligation;
  return { holding, invested, realized, obligation, profit, roi: invested > 0n ? (Number(profit) / Number(invested)) * 100 : 0 };
}

export async function getVendorStats(): Promise<{ label: string; value: string; tone?: "in" | "teal" }[]> {
  const { holding, profit, obligation } = await getVendorTotals();
  return [
    { label: "Holding", value: formatLakh(holding) },
    { label: "Profit", value: formatLakh(profit), tone: "in" },
    { label: "Obligation", value: formatLakh(obligation) },
  ];
}

export async function getVendorIds(): Promise<string[]> {
  const rows = await prisma.vendor.findMany({ select: { id: true } });
  return rows.map((r) => r.id);
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
  // Summary (invested/profit/roi) = ledger truth, profit net of obligation; schedule stays projection-based.
  const base = toDTO(v, await lifetimeInvested(id), profitOf(v.accounts) - obligation, obligation);

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
    where: { vendorId: id, type: "VENDOR_RETURN", NOT: { description: { contains: "opening" } } },
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
