import "server-only";
import { prisma } from "@/server/db";
import { formatLakh } from "@/lib/money";
import { getLoanEligibility, interestOwedByMembership, type LoanPriority } from "./loans";
import { expectedClubDeposit, type Stage } from "./members";
import { reversedTxnIds } from "./shared";
import type { PickBadgeTone } from "@/components/shared/entity-picker";

// Per-action context shown under a member's name in the Add-Entry picker — the figure relevant to
// the action being recorded (dues for a deposit, loan for a repayment, …). Preformatted ₹ strings.
export interface MemberCtx { value: string; dues: string; loan: string; interest: string; catchup: string; penalty: string }
export interface PickOptionDTO { id: string; name: string; sub: string; avatar?: string | null; badge?: string; badgeTone?: PickBadgeTone; ctx?: MemberCtx }
export interface EntryPickerOptions {
  members: PickOptionDTO[];
  vendors: PickOptionDTO[];
  treasurers: PickOptionDTO[];
  loanCandidates: PickOptionDTO[]; // members annotated with next-loan eligibility + priority (§8)
}

const PRIORITY_TONE: Record<LoanPriority, PickBadgeTone> = { High: "high", Medium: "med", Low: "low" };

/** Per active member, the figures the Add-Entry picker surfaces per action (paise). */
async function getMemberEntryContext(): Promise<Map<string, { value: bigint; dues: bigint; loan: bigint; interest: bigint; catchup: bigint; penalty: bigint }>> {
  const reversedIds = await reversedTxnIds();
  const [cfg, owedByMs, memberships, deposits, chargePaid] = await Promise.all([
    prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { stages: true } }),
    interestOwedByMembership(),
    prisma.membership.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        member: { select: { id: true } },
        accounts: { where: { kind: "MEMBER_EQUITY" }, select: { id: true, balance: true } },
        loans: { where: { status: "ACTIVE" }, select: { principalOutstanding: true } },
        charges: { select: { kind: true, amount: true } },
      },
    }),
    // Periodic-only: deposit dues are measured against monthly deposits, not catch-up (§7).
    prisma.entry.groupBy({ by: ["accountId"], _sum: { amount: true }, where: { account: { kind: "MEMBER_EQUITY" }, transaction: { type: "PERIODIC_DEPOSIT", id: { notIn: reversedIds } } } }),
    prisma.entry.findMany({ where: { transaction: { type: { in: ["CATCHUP", "PENALTY"] }, id: { notIn: reversedIds } } }, select: { amount: true, transaction: { select: { membershipId: true, type: true } } } }),
  ]);
  const expected = expectedClubDeposit((cfg?.stages as Stage[] | undefined) ?? []);
  const depByAcct = new Map(deposits.map((d) => [d.accountId, -(d._sum.amount ?? 0n)])); // equity is credit → negate
  // Pay-downs credit the charge with a negative leg, so paidByMsKind is ≤ 0; outstanding = raised + paid.
  const paidByMsKind = new Map<string, bigint>();
  for (const e of chargePaid) {
    const key = `${e.transaction.membershipId}:${e.transaction.type}`;
    paidByMsKind.set(key, (paidByMsKind.get(key) ?? 0n) + e.amount);
  }
  const clamp = (v: bigint) => (v > 0n ? v : 0n);

  const out = new Map<string, { value: bigint; dues: bigint; loan: bigint; interest: bigint; catchup: bigint; penalty: bigint }>();
  for (const ms of memberships) {
    const equity = ms.accounts[0];
    const value = -(equity?.balance ?? 0n);
    const paid = equity ? depByAcct.get(equity.id) ?? 0n : 0n;
    const raised = (k: "CATCHUP" | "PENALTY") => ms.charges.filter((c) => c.kind === k).reduce((s, c) => s + c.amount, 0n);
    out.set(ms.member.id, {
      value,
      dues: clamp(expected - paid),
      loan: ms.loans.reduce((s, l) => s + l.principalOutstanding, 0n),
      interest: owedByMs.get(ms.id) ?? 0n,
      catchup: clamp(raised("CATCHUP") + (paidByMsKind.get(`${ms.id}:CATCHUP`) ?? 0n)),
      penalty: clamp(raised("PENALTY") + (paidByMsKind.get(`${ms.id}:PENALTY`) ?? 0n)),
    });
  }
  return out;
}

const fullName = (f: string, l: string | null) => [f, l].filter(Boolean).join(" ");

/**
 * Cash-holder options for every treasurer picker (add-entry holder + record-payment).
 * The club has no account of its own — ANY member can hold its cash — so this lists all
 * members, sorted: already holding money → active → inactive, then alphabetical.
 */
export async function getCashHolderOptions(): Promise<PickOptionDTO[]> {
  const members = await prisma.member.findMany({
    select: {
      id: true, firstName: true, lastName: true, avatarUrl: true,
      treasury: { select: { balance: true } },
      memberships: { select: { status: true } },
    },
  });
  return members
    .map((m) => {
      const balance = m.treasury[0]?.balance ?? 0n;
      const active = m.memberships.some((s) => s.status === "ACTIVE");
      const rank = balance > 0n ? 0 : active ? 1 : 2; // holding money → active → inactive
      return { id: m.id, name: fullName(m.firstName, m.lastName), sub: `Holds ${formatLakh(balance)}`, avatar: m.avatarUrl, rank };
    })
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    .map(({ id, name, sub, avatar }) => ({ id, name, sub, avatar }));
}

/** Directory options for the Add-Entry pickers (members / vendors / treasurers). */
export async function getEntryPickerOptions(): Promise<EntryPickerOptions> {
  const [members, vendors, treasurers, eligibility, memberCtx] = await Promise.all([
    prisma.member.findMany({
      where: { memberships: { some: { status: "ACTIVE" } } },
      orderBy: { firstName: "asc" },
      select: {
        id: true, firstName: true, lastName: true, avatarUrl: true,
        memberships: { where: { status: "ACTIVE" }, select: { accounts: { where: { kind: "MEMBER_EQUITY" }, select: { balance: true } } } },
      },
    }),
    prisma.vendor.findMany({
      where: { status: { not: "CLOSED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, accounts: { where: { kind: "VENDOR_RECEIVABLE" }, select: { balance: true } } },
    }),
    getCashHolderOptions(),
    getLoanEligibility(),
    getMemberEntryContext(),
  ]);
  const ctxOf = (id: string): MemberCtx => {
    const c = memberCtx.get(id);
    return {
      value: `Value ${formatLakh(c?.value ?? 0n)}`,
      dues: c && c.dues > 0n ? `${formatLakh(c.dues)} dues pending` : "No dues pending",
      loan: c && c.loan > 0n ? `${formatLakh(c.loan)} loan outstanding` : "No active loan",
      interest: c && c.interest > 0n ? `${formatLakh(c.interest)} interest due` : "No interest due",
      catchup: c && c.catchup > 0n ? `${formatLakh(c.catchup)} catch-up left` : "No catch-up left",
      penalty: c && c.penalty > 0n ? `${formatLakh(c.penalty)} penalty left` : "No penalty left",
    };
  };

  const avatarById = new Map(members.map((m) => [m.id, m.avatarUrl]));

  // Give-a-loan picker: eligible + highest-priority first, each tagged. A member with an active
  // loan stays selectable (a hand-out attaches as a tranche); cooldown-blocked members are flagged.
  const loanCandidates: PickOptionDTO[] = eligibility.map((e) => ({
    id: e.memberId,
    name: e.member,
    sub: e.reason,
    avatar: avatarById.get(e.memberId),
    badge: e.eligible ? `${e.priority} priority` : e.hasActiveLoan ? "Tranche" : "Cooldown",
    badgeTone: e.eligible ? PRIORITY_TONE[e.priority] : "warn",
  }));

  return {
    members: members.map((m) => {
      const ctx = ctxOf(m.id);
      return { id: m.id, name: fullName(m.firstName, m.lastName), sub: ctx.value, avatar: m.avatarUrl, ctx };
    }),
    vendors: vendors.map((v) => ({ id: v.id, name: v.name, sub: `Invested ${formatLakh(v.accounts[0]?.balance ?? 0n)}` })),
    treasurers,
    loanCandidates,
  };
}
