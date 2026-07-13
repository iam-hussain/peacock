import "server-only";
import { prisma } from "@/server/db";
import { cachedStats } from "@/server/stats";
import { formatPaise } from "@/lib/money";
import { dayMonthYear } from "@/lib/date";
import { OPENING_ACCOUNT_ID } from "./shared";
import { UNSAFE_TO_DELETE } from "@/server/ledger/reverse";
import type { TxnType } from "@prisma/client";

export type Dir = "in" | "out" | "neutral";
export type Role = "treasurer" | "member" | "vendor";
export interface Party { name: string; role: Role }
export interface TxnDTO {
  id: string; what: string; dir: Dir; from: Party; to: Party; date: string; entered: string; method: string; amount: string;
  note: string | null; // the entry's description, shown on the row when present
  // correction affordances (§16): amount/date prefill + which actions this row allows
  canEdit: boolean; canDelete: boolean; amountValue: string; isoDate: string;
}

const WHAT: Record<TxnType, string> = {
  PERIODIC_DEPOSIT: "Member paid deposit", CATCHUP: "Catch-up payment", PENALTY: "Delayed-payment penalty",
  WITHDRAW: "Member leaves (settle up)", REJOIN: "Member rejoins", FUNDS_TRANSFER: "Funds transfer",
  LOAN_TAKEN: "Give a loan", LOAN_REPAY: "Record repayment", LOAN_INTEREST: "Collect interest",
  VENDOR_INVEST: "Vendor investment", VENDOR_RETURN: "Vendor return", VENDOR_WRITEOFF: "Vendor write-off",
  CHIT_PAYMENT: "Chit installment", CHIT_PAYOUT: "Chit payout", REVERSAL: "Reversal",
  PROFIT_WITHDRAW: "Profit withdrawal",
};
const METHODS = ["Cash", "UPI", "Bank"];
const methodFor = (id: string) => METHODS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % METHODS.length];

type EntryRow = {
  amount: bigint;
  account: {
    kind: string;
    member: { firstName: string; lastName: string | null } | null;
    membership: { member: { firstName: string; lastName: string | null } } | null;
    vendor: { name: string } | null;
  };
};
const nameOf = (p: { firstName: string; lastName: string | null } | null | undefined) =>
  p ? [p.firstName, p.lastName].filter(Boolean).join(" ") : "";

function partiesFor(
  type: TxnType,
  entries: EntryRow[],
  memberName?: string, // member tied to the txn's membershipId — the counterparty for legs with no member account (interest, penalty)
): { from: Party; to: Party; dir: Dir; amount: bigint } {
  const treasuryLegs = entries.filter((e) => e.account.kind === "TREASURY_CASH");
  const club: Party = { name: "Club", role: "treasurer" };
  const treasurerParty = (e?: EntryRow): Party => ({ name: nameOf(e?.account.member) || "Club", role: "treasurer" });
  const otherLeg = entries.find((e) => e.account.kind === "MEMBER_EQUITY" || e.account.kind === "LOAN_RECEIVABLE" || e.account.kind.startsWith("VENDOR"));
  const otherParty = (): Party => {
    if (!otherLeg) return memberName ? { name: memberName, role: "member" } : club;
    if (otherLeg.account.kind.startsWith("VENDOR")) return { name: otherLeg.account.vendor?.name ?? "Vendor", role: "vendor" };
    return { name: nameOf(otherLeg.account.membership?.member), role: "member" };
  };

  if (type === "FUNDS_TRANSFER" && treasuryLegs.length === 2) {
    const out = treasuryLegs.find((e) => e.amount < 0n);
    const inn = treasuryLegs.find((e) => e.amount > 0n);
    return { from: treasurerParty(out), to: treasurerParty(inn), dir: "neutral", amount: inn ? inn.amount : 0n };
  }
  const t = treasuryLegs[0];
  const amount = t ? (t.amount < 0n ? -t.amount : t.amount) : otherLeg ? (otherLeg.amount < 0n ? -otherLeg.amount : otherLeg.amount) : 0n;
  if (t && t.amount > 0n) return { from: otherParty(), to: treasurerParty(t), dir: "in", amount };
  if (t && t.amount < 0n) return { from: treasurerParty(t), to: otherParty(), dir: "out", amount };
  return { from: otherParty(), to: club, dir: "neutral", amount };
}

/** The ledger feed — real postings only. Opening-import scaffolding, reversal entries, and any
 *  posting that has since been reversed (§16) are all excluded so a deleted/edited row drops out. */
export async function getTransactions(limit?: number, offset?: number): Promise<TxnDTO[]> {
  const txns = await prisma.transaction.findMany({
    where: {
      type: { not: "REVERSAL" },
      reversed: false,
      entries: { none: { accountId: OPENING_ACCOUNT_ID } },
    },
    orderBy: { occurredAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true, type: true, occurredAt: true, createdAt: true, description: true, membershipId: true,
      entries: { select: { amount: true, account: { select: { kind: true, member: { select: { firstName: true, lastName: true } }, membership: { select: { member: { select: { firstName: true, lastName: true } } } }, vendor: { select: { name: true } } } } } },
    },
  });

  // Interest/penalty postings tag the borrower via the txn's membershipId (no member account leg),
  // so resolve those names in one batched query to name the counterparty instead of falling back to "Club".
  const membershipIds = [...new Set(txns.map((t) => t.membershipId).filter((id): id is string => !!id))];
  const memberships = membershipIds.length
    ? await prisma.membership.findMany({ where: { id: { in: membershipIds } }, select: { id: true, member: { select: { firstName: true, lastName: true } } } })
    : [];
  const memberByMembership = new Map(memberships.map((m) => [m.id, nameOf(m.member)]));

  return txns.map((t) => {
    const memberName = t.membershipId ? memberByMembership.get(t.membershipId) : undefined;
    const { from, to, dir, amount } = partiesFor(t.type, t.entries, memberName);
    const sign = dir === "in" ? "+" : dir === "out" ? "−" : "";
    return {
      id: t.id, what: WHAT[t.type], dir, from, to,
      date: dayMonthYear(t.occurredAt), entered: dayMonthYear(t.createdAt), method: methodFor(t.id),
      amount: sign + formatPaise(amount), note: t.description ?? null,
      canEdit: true, // every posted (non-reversal) row can be amount/date-corrected (§16)
      canDelete: !UNSAFE_TO_DELETE.has(t.type),
      amountValue: (Number(amount) / 100).toString(),
      isoDate: t.occurredAt.toISOString().slice(0, 10),
    } satisfies TxnDTO;
  });
}

/** The full mapped ledger, memoised under ONE StatsCache key. The transactions API, audit feed and
 *  CSV export all read this instead of each re-mapping the ledger on their own cold compute. */
export const fullLedger = (): Promise<TxnDTO[]> => cachedStats("transactions", () => getTransactions());

export interface TxnFilter {
  q?: string;
  type?: string; // a WHAT label ("Member paid deposit")
  party?: string; // exact party name
  start?: string; // inclusive ISO date bounds
  end?: string;
  page: number;
  size: number;
}

export interface TxnPageDTO {
  rows: TxnDTO[];
  total: number; // rows matching the filters
  all: number; // unfiltered ledger size
  pageCount: number;
  typeOpts: string[]; // filter options, derived from the whole ledger
  parties: Party[];
}

/** One page of the ledger, filtered server-side — the browser gets ~one page (not the whole
 *  ledger) per request; the full DTO stays memoised in StatsCache via `fullLedger`. */
export async function getTransactionsPage(f: TxnFilter): Promise<TxnPageDTO> {
  const ledger = await fullLedger();
  const s = f.q?.trim().toLowerCase();
  const rows = ledger.filter((t) => {
    if (f.type && t.what !== f.type) return false;
    if (f.party && t.from.name !== f.party && t.to.name !== f.party) return false;
    if (f.start && t.isoDate < f.start) return false;
    if (f.end && t.isoDate > f.end) return false;
    if (
      s &&
      !(
        t.what.toLowerCase().includes(s) ||
        t.from.name.toLowerCase().includes(s) ||
        t.to.name.toLowerCase().includes(s) ||
        t.amount.toLowerCase().includes(s) ||
        (t.note?.toLowerCase().includes(s) ?? false)
      )
    )
      return false;
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(rows.length / f.size));
  const page = Math.min(f.page, pageCount);
  const typeOpts = [...new Set(ledger.map((t) => t.what))];
  const parties = [...new Map(ledger.flatMap((t) => [t.from, t.to]).map((p) => [p.name, p])).values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  return { rows: rows.slice((page - 1) * f.size, page * f.size), total: rows.length, all: ledger.length, pageCount, typeOpts, parties };
}
