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
  profit: string;
}

function pct(profit: bigint, invested: bigint): string {
  if (invested === 0n) return "0%";
  const p = (Number(profit) / Number(invested)) * 100;
  return `${p >= 0 ? "+" : "−"}${Math.abs(p).toFixed(1)}%`;
}

function toDTO(
  v: { id: string; name: string; type: "GENERAL" | "CHIT"; category: string | null; status: string; startedAt: Date; chit: { durationMonths: number } | null },
  invested: bigint,
  profit: bigint,
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
    profit: (profit >= 0n ? "+" : "") + formatPaise(profit),
  };
}

export interface ChitStats {
  paidCount: number; totalPaid: bigint; payout: bigint; taken: boolean; payoutAt: Date | null;
  payoutMonth: number; obligation: bigint; pl: bigint; paidInstallments: { date: Date; amt: bigint }[];
}

/**
 * Chit economics derived from the ACTUAL ledger (the ChitFund payout fields aren't
 * populated by postings). Obligation left = remaining months × margin; P/L = what you
 * receive (payout if taken, else the face value) minus what you pay over the chit's
 * life (installments paid so far + remaining months at the margin cap).
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
  const pl = (taken ? payout : chit.chitValue) - (totalPaid + obligation);
  return { paidCount, totalPaid, payout, taken, payoutAt, payoutMonth, obligation, pl, paidInstallments };
}

// List-level invested + profit per vendor: chits use their real economics (paid-in +
// projected P/L); general vendors use outstanding receivable + realized VENDOR_PROFIT.
async function vendorFinancials(v: {
  id: string; type: string; accounts: { kind: string; balance: bigint }[];
  chit: { chitValue: bigint; durationMonths: number; marginInstallment: bigint } | null;
}): Promise<{ invested: bigint; profit: bigint }> {
  if (v.type === "CHIT" && v.chit) {
    const s = await chitLedger(v.id, v.chit);
    return { invested: s.totalPaid, profit: s.pl };
  }
  return {
    invested: v.accounts.find((a) => a.kind === "VENDOR_RECEIVABLE")?.balance ?? 0n,
    profit: -(v.accounts.find((a) => a.kind === "VENDOR_PROFIT")?.balance ?? 0n),
  };
}

const LIST_SELECT = {
  id: true, name: true, type: true, category: true, status: true, startedAt: true,
  accounts: { select: { kind: true, balance: true } },
  chit: { select: { chitValue: true, durationMonths: true, marginInstallment: true } },
} as const;

export async function getVendors(): Promise<VendorDTO[]> {
  const vendors = await prisma.vendor.findMany({ orderBy: { name: "asc" }, select: LIST_SELECT });
  return Promise.all(vendors.map(async (v) => { const f = await vendorFinancials(v); return toDTO(v, f.invested, f.profit); }));
}

export async function getVendorStats(): Promise<{ label: string; value: string; tone?: "in" | "teal" }[]> {
  const vendors = await prisma.vendor.findMany({ select: LIST_SELECT });
  const fin = await Promise.all(vendors.map(vendorFinancials));
  const invested = fin.reduce((s, f) => s + f.invested, 0n);
  const profit = fin.reduce((s, f) => s + f.profit, 0n);
  const roi = invested > 0n ? (Number(profit) / Number(invested)) * 100 : 0;
  return [
    { label: "Invested", value: formatLakh(invested) },
    { label: "Returns", value: formatLakh(profit), tone: "in" },
    { label: "Avg. ROI", value: `${roi.toFixed(1)}%`, tone: "teal" },
  ];
}

export async function getVendorIds(): Promise<string[]> {
  const rows = await prisma.vendor.findMany({ select: { id: true } });
  return rows.map((r) => r.id);
}

// ---------------- details ----------------
export interface ChitDetailDTO extends VendorDTO {
  start: string; months: number; paidCount: number; valueDisp: string; marginDisp: string;
  totalPaidDisp: string; obligationDisp: string; payoutDisp: string; taken: boolean; payoutMonth: number;
  plDisp: string; plPositive: boolean;
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
  const { paidCount, totalPaid, payout, taken, payoutMonth, obligation, pl, paidInstallments } = s;
  const base = toDTO(v, totalPaid, pl);

  return {
    ...base,
    start: monthYear(c.startedAt),
    months,
    paidCount,
    valueDisp: formatPaise(c.chitValue),
    marginDisp: formatPaise(margin),
    totalPaidDisp: formatPaise(totalPaid),
    obligationDisp: formatPaise(obligation),
    payoutDisp: formatPaise(payout),
    taken,
    payoutMonth,
    plDisp: (pl >= 0n ? "+" : "−") + formatPaise(pl < 0n ? -pl : pl),
    plPositive: pl >= 0n,
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
  const invested = v.accounts.find((a) => a.kind === "VENDOR_RECEIVABLE")?.balance ?? 0n;
  const profit = -(v.accounts.find((a) => a.kind === "VENDOR_PROFIT")?.balance ?? 0n);
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
    currentDisp: formatLakh(invested + profit),
    lastReturn: returns[0] ? dayMonthYear(returns[0].occurredAt) : "—",
    history: returns.map((r) => ({ month: monthYear(r.occurredAt), amt: formatPaise(r.entries.reduce((s, e) => s + e.amount, 0n)) })),
  };
}
