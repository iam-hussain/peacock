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

function toDTO(v: {
  id: string; name: string; type: "GENERAL" | "CHIT"; category: string | null; status: string; startedAt: Date;
  accounts: { kind: string; balance: bigint }[];
  chit: { durationMonths: number } | null;
}): VendorDTO {
  const invested = v.accounts.find((a) => a.kind === "VENDOR_RECEIVABLE")?.balance ?? 0n;
  const profit = -(v.accounts.find((a) => a.kind === "VENDOR_PROFIT")?.balance ?? 0n);
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

export async function getVendors(): Promise<VendorDTO[]> {
  const vendors = await prisma.vendor.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, type: true, category: true, status: true, startedAt: true, accounts: { select: { kind: true, balance: true } }, chit: { select: { durationMonths: true } } },
  });
  return vendors.map(toDTO);
}

export async function getVendorStats(): Promise<{ label: string; value: string; tone?: "in" | "teal" }[]> {
  const accts = await prisma.ledgerAccount.findMany({ where: { OR: [{ kind: "VENDOR_RECEIVABLE" }, { kind: "VENDOR_PROFIT" }] }, select: { kind: true, balance: true } });
  const invested = accts.filter((a) => a.kind === "VENDOR_RECEIVABLE").reduce((s, a) => s + a.balance, 0n);
  const profit = accts.filter((a) => a.kind === "VENDOR_PROFIT").reduce((s, a) => s - a.balance, 0n);
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
  const base = toDTO({ ...v, chit: { durationMonths: v.chit.durationMonths } });
  const c = v.chit;
  const months = c.durationMonths;
  const margin = c.marginInstallment;
  const paid = v.accounts.find((a) => a.kind === "VENDOR_RECEIVABLE")?.balance ?? 0n;
  const paidCount = margin > 0n ? Number(paid / margin) : 0;
  const obligation = c.chitValue - paid;
  const taken = !!c.payoutMonth;
  const pl = (c.payoutAmount ?? 0n) - c.chitValue;
  return {
    ...base,
    start: monthYear(c.startedAt),
    months,
    paidCount,
    valueDisp: formatPaise(c.chitValue),
    marginDisp: formatPaise(margin),
    totalPaidDisp: formatPaise(paid),
    obligationDisp: formatPaise(obligation),
    payoutDisp: formatPaise(c.payoutAmount ?? 0n),
    taken,
    payoutMonth: c.payoutMonth ?? 0,
    plDisp: (pl >= 0n ? "+" : "−") + formatPaise(pl < 0n ? -pl : pl),
    plPositive: pl >= 0n,
    installments: Array.from({ length: months }, (_, i) => {
      const n = i + 1;
      const amt = margin - (margin / 3n) + (margin / 3n / BigInt(months)) * BigInt(n);
      return { n, isPayout: n === (c.payoutMonth ?? -1), lbl: n <= paidCount ? "paid" : "due", amt: formatPaise(amt < margin ? amt : margin), paid: n <= paidCount };
    }),
  };
}

export async function getGeneralDetail(id: string): Promise<GeneralDetailDTO | null> {
  const v = await loadVendor(id);
  if (!v || v.type !== "GENERAL") return null;
  const base = toDTO({ ...v, chit: null });
  const invested = v.accounts.find((a) => a.kind === "VENDOR_RECEIVABLE")?.balance ?? 0n;
  const profit = -(v.accounts.find((a) => a.kind === "VENDOR_PROFIT")?.balance ?? 0n);
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
