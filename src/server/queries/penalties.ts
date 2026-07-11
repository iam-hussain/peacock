import "server-only";
import { prisma } from "@/server/db";
import { formatPaise, roundToWholeRupee } from "@/lib/money";
import { istDate, dayMonthYear, monthYear } from "@/lib/date";
import { reversedTxnIds } from "./shared";
import { expectedClubDeposit, type Stage } from "./members";
import { loanEventsMap, reconstructCycles } from "./loans";

/**
 * Automatic penalties (PRODUCT.md §13.2). Two independently-toggled, admin-configurable penalties,
 * off by default, that start accruing from a single global effective-from date:
 *
 *   • Deposit penalty — on the 1st of each month (IST), if a member's deposit pending is over the
 *     minimum (₹6,000), add `rate%` of that pending. Whole months only.
 *   • Loan-interest penalty — once a loan closes with interest unpaid, after a grace window and every
 *     `graceDays` thereafter, if pending interest is over the minimum (₹1,000), add `rate%` of it.
 *
 * Both are SIMPLE (the rate is on the pending base — deposits / interest — never on prior penalty,
 * and the loan penalty is never on principal). They materialise as real `Charge` rows (kind PENALTY,
 * `auto`) with a DETERMINISTIC id per period, so a re-sync can never duplicate one; the amount is
 * frozen when first written. This module is pure/read-only — the writer lives in
 * `server/ledger/auto-penalties.ts`.
 */

// ---------------- config ----------------

export interface PenaltyRule {
  enabled: boolean;
  rateBps: number; // e.g. 200 = 2% / period
  minPaise: bigint; // only charge when the pending base exceeds this
}
export interface InterestRule extends PenaltyRule {
  graceDays: number; // days after loan close before the first tick, then every graceDays
}
export interface PenaltyConfig {
  effectiveFrom: Date; // IST date; nothing accrues before this (both penalties)
  deposit: PenaltyRule;
  interest: InterestRule;
}

export const PENALTY_DEFAULTS: PenaltyConfig = {
  effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
  deposit: { enabled: false, rateBps: 200, minPaise: 600000n }, // 2% of pending over ₹6,000
  interest: { enabled: false, rateBps: 200, minPaise: 100000n, graceDays: 30 }, // 2% of pending interest over ₹1,000
};

// Stored JSON shape (BigInt lives as a string — JSON has no BigInt): matches saveClubSettings.
interface StoredRule { enabled?: boolean; rateBps?: number; minPaise?: string | number }
interface StoredConfig { effectiveFrom?: string; deposit?: StoredRule; interest?: StoredRule & { graceDays?: number } }

const paise = (v: string | number | undefined, fallback: bigint): bigint => {
  if (v == null || v === "") return fallback;
  try { return BigInt(v); } catch { return fallback; }
};

/** Parse the stored `ClubConfig.penaltyConfig` JSON into a fully-defaulted config. Null/missing
 *  fields fall back to PENALTY_DEFAULTS, so an old row (no penaltyConfig) reads as "both off". */
export function parsePenaltyConfig(raw: unknown): PenaltyConfig {
  const s = (raw ?? {}) as StoredConfig;
  const from = s.effectiveFrom ? new Date(s.effectiveFrom) : PENALTY_DEFAULTS.effectiveFrom;
  const d = s.deposit ?? {};
  const i = s.interest ?? {};
  return {
    effectiveFrom: istDate(Number.isNaN(from.getTime()) ? PENALTY_DEFAULTS.effectiveFrom : from),
    deposit: {
      enabled: d.enabled ?? PENALTY_DEFAULTS.deposit.enabled,
      rateBps: d.rateBps ?? PENALTY_DEFAULTS.deposit.rateBps,
      minPaise: paise(d.minPaise, PENALTY_DEFAULTS.deposit.minPaise),
    },
    interest: {
      enabled: i.enabled ?? PENALTY_DEFAULTS.interest.enabled,
      rateBps: i.rateBps ?? PENALTY_DEFAULTS.interest.rateBps,
      minPaise: paise(i.minPaise, PENALTY_DEFAULTS.interest.minPaise),
      graceDays: i.graceDays ?? PENALTY_DEFAULTS.interest.graceDays,
    },
  };
}

/** Serialise a config back to the stored JSON shape (BigInt → string). */
export function serializePenaltyConfig(c: PenaltyConfig): StoredConfig {
  return {
    effectiveFrom: c.effectiveFrom.toISOString().slice(0, 10),
    deposit: { enabled: c.deposit.enabled, rateBps: c.deposit.rateBps, minPaise: c.deposit.minPaise.toString() },
    interest: { enabled: c.interest.enabled, rateBps: c.interest.rateBps, minPaise: c.interest.minPaise.toString(), graceDays: c.interest.graceDays },
  };
}

export async function getPenaltyConfig(): Promise<PenaltyConfig> {
  const cfg = await prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { penaltyConfig: true } });
  return parsePenaltyConfig(cfg?.penaltyConfig);
}

// ---------------- pure period walks ----------------

const monthIdx = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();
const firstOfMonth = (idx: number): Date => new Date(Date.UTC(Math.floor(idx / 12), idx % 12, 1));
const addDays = (d: Date, n: number): Date => new Date(istDate(d).getTime() + n * 86_400_000);
const pct = (base: bigint, rateBps: number): bigint => (base * BigInt(rateBps)) / 10000n;
const ymd = (d: Date): string => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;

/** One materialisable auto penalty — a Charge to be upserted by its deterministic `id`. */
export interface DueCharge {
  id: string;
  membershipId: string;
  reason: "AUTO_DEPOSIT_PENALTY" | "AUTO_LOAN_INTEREST_PENALTY";
  amount: bigint; // rate% of base
  base: bigint; // the pending deposit / interest the rate was applied to
  occurredAt: Date;
  note: string; // human reference ("Deposit penalty · Sep 2026")
}

/** Deposit penalties due for one active member. `paidEvents` = periodic deposit magnitudes with
 *  their IST dates (positive paise). Walks the 1st of each month in [max(effectiveFrom, join), today]
 *  and charges `rate%` of that month-start's deposit pending when it exceeds the minimum. */
export function depositPenaltiesFor(
  membershipId: string,
  joinedAt: Date,
  paidEvents: { at: Date; amount: bigint }[],
  stages: Stage[],
  rule: PenaltyRule,
  effectiveFrom: Date,
  today: Date,
): DueCharge[] {
  if (!rule.enabled) return [];
  const out: DueCharge[] = [];
  const join = istDate(joinedAt);
  const startIdx = Math.max(monthIdx(effectiveFrom), monthIdx(join));
  const endIdx = monthIdx(istDate(today));
  for (let idx = startIdx; idx <= endIdx; idx++) {
    const first = firstOfMonth(idx);
    if (first < effectiveFrom || first < join) continue; // whole months from the effective date / join only
    const expected = expectedClubDeposit(stages, first);
    let paid = 0n;
    for (const e of paidEvents) if (istDate(e.at) <= first) paid += e.amount;
    const pending = expected > paid ? expected - paid : 0n;
    if (pending <= rule.minPaise) continue;
    const ym = `${first.getUTCFullYear()}${String(first.getUTCMonth() + 1).padStart(2, "0")}`;
    out.push({
      id: `apen_dep_${membershipId}_${ym}`,
      membershipId,
      reason: "AUTO_DEPOSIT_PENALTY",
      amount: pct(pending, rule.rateBps),
      base: pending,
      occurredAt: first,
      note: `Deposit penalty · ${monthYear(first)}`,
    });
  }
  return out;
}

/** Loan-interest penalties due for one active member whose loans have all closed with interest
 *  still owed. `accruedTotal` = interest generated across their (closed) loans; `anchor` = latest
 *  loan-close date; `paidEvents` = interest payment magnitudes with dates. Ticks at anchor + grace,
 *  +2·grace, … up to today, charging `rate%` of the interest still pending at each tick. */
export function interestPenaltiesFor(
  membershipId: string,
  anchor: Date,
  accruedTotal: bigint,
  paidEvents: { at: Date; amount: bigint }[],
  rule: InterestRule,
  effectiveFrom: Date,
  today: Date,
): DueCharge[] {
  if (!rule.enabled || rule.graceDays <= 0) return [];
  const out: DueCharge[] = [];
  const end = istDate(today);
  for (let k = 1; ; k++) {
    const tick = addDays(anchor, rule.graceDays * k);
    if (tick > end) break;
    if (tick < effectiveFrom) continue;
    let paid = 0n;
    for (const e of paidEvents) if (istDate(e.at) <= tick) paid += e.amount;
    const pending = accruedTotal > paid ? accruedTotal - paid : 0n;
    if (pending <= rule.minPaise) continue;
    out.push({
      // Key the id on the tick DATE, not the tick index — so changing graceDays later can never
      // re-label an existing tick (which would skip one date and double-charge another).
      id: `apen_int_${membershipId}_${ymd(tick)}`,
      membershipId,
      reason: "AUTO_LOAN_INTEREST_PENALTY",
      amount: pct(pending, rule.rateBps),
      base: pending,
      occurredAt: tick,
      note: `Loan-interest penalty · ${rule.graceDays * k} days after close`,
    });
  }
  return out;
}

// ---------------- batched compute across the club ----------------

/** Every auto penalty CURRENTLY due across the club, derived from history (integer paise). Pure read
 *  — the sync writer diffs this against existing rows and only creates the missing ones. */
export async function computeAutoPenalties(cfg: PenaltyConfig, today = new Date()): Promise<DueCharge[]> {
  if (!cfg.deposit.enabled && !cfg.interest.enabled) return [];
  const club = await prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { stages: true, dayInterestFrom: true } });
  const stages = (club?.stages as Stage[] | undefined) ?? [];
  const reversedIds = await reversedTxnIds();
  const due: DueCharge[] = [];

  // --- Deposit penalties: one query for active equities, one for their periodic deposit legs. ---
  if (cfg.deposit.enabled) {
    const active = await prisma.membership.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, joinedAt: true, accounts: { where: { kind: "MEMBER_EQUITY" }, select: { id: true } } },
    });
    const eqToMs = new Map<string, string>();
    for (const ms of active) for (const a of ms.accounts) eqToMs.set(a.id, ms.id);
    const legs = eqToMs.size
      ? await prisma.entry.findMany({
          where: { accountId: { in: [...eqToMs.keys()] }, transaction: { type: "PERIODIC_DEPOSIT", id: { notIn: reversedIds } } },
          select: { amount: true, accountId: true, transaction: { select: { occurredAt: true } } },
        })
      : [];
    const paidByMs = new Map<string, { at: Date; amount: bigint }[]>();
    for (const l of legs) {
      const msId = eqToMs.get(l.accountId);
      if (!msId) continue;
      (paidByMs.get(msId) ?? paidByMs.set(msId, []).get(msId)!).push({ at: l.transaction.occurredAt, amount: -l.amount }); // equity credit → magnitude
    }
    for (const ms of active) {
      due.push(...depositPenaltiesFor(ms.id, ms.joinedAt, paidByMs.get(ms.id) ?? [], stages, cfg.deposit, cfg.effectiveFrom, today));
    }
  }

  // --- Loan-interest penalties: active members whose loans have all closed with interest owed. ---
  if (cfg.interest.enabled) {
    const loans = await prisma.loan.findMany({
      where: { membership: { status: "ACTIVE" } },
      select: { id: true, membershipId: true, monthlyRateBps: true, closedAt: true, status: true },
    });
    const byMs = new Map<string, typeof loans>();
    for (const l of loans) (byMs.get(l.membershipId) ?? byMs.set(l.membershipId, []).get(l.membershipId)!).push(l);
    const eventsMap = await loanEventsMap(loans.map((l) => l.id));
    const intTxns = await prisma.transaction.findMany({
      where: { type: "LOAN_INTEREST", id: { notIn: reversedIds }, membershipId: { in: [...byMs.keys()] } },
      select: { membershipId: true, occurredAt: true, entries: { where: { amount: { gt: 0 } }, select: { amount: true } } },
    });
    const paidByMs = new Map<string, { at: Date; amount: bigint }[]>();
    for (const t of intTxns) {
      if (!t.membershipId) continue;
      const amt = t.entries.reduce((s, e) => s + e.amount, 0n);
      (paidByMs.get(t.membershipId) ?? paidByMs.set(t.membershipId, []).get(t.membershipId)!).push({ at: t.occurredAt, amount: amt });
    }
    for (const [msId, msLoans] of byMs) {
      if (msLoans.some((l) => l.status === "ACTIVE")) continue; // a live loan → interest still accruing, ticks pause
      const closed = msLoans.filter((l) => l.closedAt);
      if (!closed.length) continue;
      const anchor = closed.reduce((mx, l) => (l.closedAt! > mx ? l.closedAt! : mx), closed[0].closedAt!);
      const accruedTotal = msLoans.reduce((s, l) => {
        const interest = reconstructCycles(eventsMap.get(l.id) ?? [], l.monthlyRateBps, today, club!.dayInterestFrom).reduce((a, c) => a + c.interest, 0n);
        return s + roundToWholeRupee(interest);
      }, 0n);
      due.push(...interestPenaltiesFor(msId, anchor, accruedTotal, paidByMs.get(msId) ?? [], cfg.interest, cfg.effectiveFrom, today));
    }
  }

  return due;
}

// ---------------- admin "auto penalties" page ----------------

export interface AutoPenaltyRow {
  id: string;
  memberId: string;
  member: string;
  type: "Deposit" | "Loan interest";
  reference: string; // the note ("Deposit penalty · Sep 2026")
  amount: string;
  date: string;
  voided: boolean;
}
export interface AutoPenaltiesData {
  enabled: boolean; // either penalty on
  deposit: { enabled: boolean; rate: string; min: string };
  interest: { enabled: boolean; rate: string; min: string; grace: string };
  effectiveFrom: string;
  totalAssigned: string; // Σ live (non-voided) auto penalty amounts
  count: number; // live auto penalties
  rows: AutoPenaltyRow[];
}

const TYPE_OF: Record<string, "Deposit" | "Loan interest"> = {
  AUTO_DEPOSIT_PENALTY: "Deposit",
  AUTO_LOAN_INTEREST_PENALTY: "Loan interest",
};

/** The admin "auto penalties" page: every system-added penalty with its reference, newest first. */
export async function getAutoPenaltiesData(): Promise<AutoPenaltiesData> {
  const cfg = await getPenaltyConfig();
  const charges = await prisma.charge.findMany({
    where: { auto: true },
    orderBy: { occurredAt: "desc" },
    select: {
      id: true, reason: true, amount: true, occurredAt: true, note: true, voidedAt: true,
      membership: { select: { member: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });
  let totalAssigned = 0n;
  let count = 0;
  const rows: AutoPenaltyRow[] = charges.map((c) => {
    const voided = !!c.voidedAt;
    if (!voided) { totalAssigned += c.amount; count++; }
    const m = c.membership.member;
    return {
      id: c.id,
      memberId: m.id,
      member: [m.firstName, m.lastName].filter(Boolean).join(" "),
      type: TYPE_OF[c.reason] ?? "Deposit",
      reference: c.note ?? "—",
      amount: formatPaise(c.amount),
      date: dayMonthYear(c.occurredAt),
      voided,
    };
  });
  const rate = (bps: number) => `${bps / 100}%`;
  return {
    enabled: cfg.deposit.enabled || cfg.interest.enabled,
    deposit: { enabled: cfg.deposit.enabled, rate: rate(cfg.deposit.rateBps), min: formatPaise(cfg.deposit.minPaise) },
    interest: { enabled: cfg.interest.enabled, rate: rate(cfg.interest.rateBps), min: formatPaise(cfg.interest.minPaise), grace: `${cfg.interest.graceDays} days` },
    effectiveFrom: dayMonthYear(cfg.effectiveFrom),
    totalAssigned: formatPaise(totalAssigned),
    count,
    rows,
  };
}
