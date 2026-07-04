import { prisma } from "@/server/db";
import type { Prisma, TxnType } from "@prisma/client";
import { rupeesToPaise, formatPaise } from "@/lib/money";
import { addMonths } from "@/lib/date";
import { ensureTreasury, ensureEquity, ensureIncome, ensureVendorAccount, ensureLoanReceivable } from "./accounts";
import { postTransaction } from "./post-transaction";

// The add-entry "What happened?" labels → ledger TxnType (§8).
export const INTENT_TO_TYPE: Record<string, TxnType> = {
  "Member paid deposit": "PERIODIC_DEPOSIT",
  "Catch-up payment": "CATCHUP",
  "Delayed-payment penalty": "PENALTY",
  "Record repayment": "LOAN_REPAY",
  "Collect interest": "LOAN_INTEREST",
  "Vendor return": "VENDOR_RETURN",
  "Vendor write-off": "VENDOR_WRITEOFF",
  "Chit payout": "CHIT_PAYOUT",
  "Member rejoins": "REJOIN",
  "Give a loan": "LOAN_TAKEN",
  "Vendor investment": "VENDOR_INVEST",
  "Chit installment": "CHIT_PAYMENT",
  "Member leaves (settle up)": "WITHDRAW",
  "Funds transfer": "FUNDS_TRANSFER",
};

export interface EntryPayload {
  intent: string;
  party?: string; // member OR vendor name (depends on intent)
  partyId?: string; // picked member id — preferred over `party` name to avoid ambiguity
  amount?: string;
  principal?: string; // for VENDOR_RETURN / CHIT_PAYOUT / LOAN_REPAY splits
  treasurer?: string; // person holding/receiving cash
  treasurerId?: string; // picked treasurer/member id — preferred over `treasurer` name
  date?: string;
  note?: string;
}

// Resolve a member id-first (the picker carries it), falling back to first/last name only for legacy
// payloads with no id. The id path is unambiguous; the name fallback can mis-resolve duplicate names.
async function resolveMember(name?: string, id?: string) {
  if (id) return prisma.member.findUnique({ where: { id } });
  if (!name) return null;
  const [first, ...rest] = name.trim().split(/\s+/);
  return prisma.member.findFirst({ where: { firstName: first, lastName: rest.length ? rest.join(" ") : undefined } });
}
async function activeMembership(memberId: string) {
  return (
    (await prisma.membership.findFirst({ where: { memberId, status: "ACTIVE" }, orderBy: { seq: "desc" } })) ??
    (await prisma.membership.findFirst({ where: { memberId }, orderBy: { seq: "desc" } }))
  );
}

/**
 * Resolve a submission payload to a balanced posting and commit it (§8). Member/
 * treasury intents are fully wired; vendor intents post when the vendor exists.
 * Loan intents are deferred (need the loan lifecycle + interest engine, §14).
 */
export async function postIntent(payload: EntryPayload, actorId?: string, outerTx?: Prisma.TransactionClient): Promise<{ id: string }> {
  const type = INTENT_TO_TYPE[payload.intent];
  if (!type) throw new Error(`Unknown intent: ${payload.intent}`);
  const A = rupeesToPaise(payload.amount ?? "0");
  if (A <= 0n) throw new Error("Amount must be greater than zero.");
  const occurredAt = payload.date ? new Date(payload.date) : new Date();
  const note = payload.note ?? null;

  // Run the post + its side-effect writes atomically: reuse the caller's `outerTx` when present
  // (e.g. approveSubmission), otherwise open a fresh transaction. Prevents a crash between the
  // posting and the loan/membership update from desyncing the ledger from side-table state.
  const atomically = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> =>
    outerTx ? fn(outerTx) : prisma.$transaction(fn);

  const withMember = async () => {
    const m = await resolveMember(payload.party, payload.partyId);
    if (!m) throw new Error(`Member "${payload.party ?? ""}" not found.`);
    const ms = await activeMembership(m.id);
    if (!ms) throw new Error(`No membership for ${payload.party}.`);
    return { m, ms };
  };
  const treasuryId = async () => {
    const t = await resolveMember(payload.treasurer, payload.treasurerId);
    if (!t) throw new Error("Pick the treasurer handling the cash.");
    return ensureTreasury(t.id);
  };

  switch (type) {
    // TREASURY +A, MEMBER_EQUITY −A (builds member capital)
    case "PERIODIC_DEPOSIT":
    case "CATCHUP":
    case "REJOIN": {
      const { ms } = await withMember();
      const [t, e] = await Promise.all([treasuryId(), ensureEquity(ms.id)]);
      return atomically(async (tx) => {
        const txn = await postTransaction({ type, occurredAt, description: note, membershipId: ms.id, lines: [ { accountId: t, amount: A }, { accountId: e, amount: -A } ], actorId }, tx);
        if (type === "REJOIN") await tx.membership.update({ where: { id: ms.id }, data: { status: "ACTIVE" } });
        return txn;
      });
    }
    // TREASURY +A, OTHER_INCOME −A (penalty pay-down = club income)
    case "PENALTY": {
      await withMember();
      const [t, o] = await Promise.all([treasuryId(), ensureIncome("OTHER_INCOME")]);
      return postTransaction({ type, occurredAt, description: note, lines: [ { accountId: t, amount: A }, { accountId: o, amount: -A } ], actorId }, outerTx);
    }
    // TREASURY −A, MEMBER_EQUITY +A (settle & leave); membership → CLOSED
    case "WITHDRAW": {
      const { ms } = await withMember();
      const [t, e] = await Promise.all([treasuryId(), ensureEquity(ms.id)]);
      return atomically(async (tx) => {
        const txn = await postTransaction({ type, occurredAt, description: note, membershipId: ms.id, lines: [ { accountId: t, amount: -A }, { accountId: e, amount: A } ], actorId }, tx);
        await tx.membership.update({ where: { id: ms.id }, data: { status: "CLOSED", leftAt: occurredAt, settledAmount: A } });
        return txn;
      });
    }
    // TREASURY(from) −A, TREASURY(to) +A
    case "FUNDS_TRANSFER": {
      const from = await resolveMember(payload.treasurer, payload.treasurerId);
      const to = await resolveMember(payload.party, payload.partyId);
      if (!from || !to) throw new Error("Funds transfer needs a source and destination treasurer.");
      const [ft, tt] = await Promise.all([ensureTreasury(from.id), ensureTreasury(to.id)]);
      return postTransaction({ type, occurredAt, description: note, lines: [ { accountId: ft, amount: -A }, { accountId: tt, amount: A } ], actorId }, outerTx);
    }
    // TREASURY −A, VENDOR_RECEIVABLE +A
    case "VENDOR_INVEST":
    case "CHIT_PAYMENT": {
      const v = await prisma.vendor.findFirst({ where: { name: payload.party } });
      if (!v) throw new Error(`Vendor "${payload.party ?? ""}" not found.`);
      const [t, r] = await Promise.all([treasuryId(), ensureVendorAccount(v.id, "VENDOR_RECEIVABLE")]);
      return postTransaction({ type, occurredAt, description: note, vendorId: v.id, lines: [ { accountId: t, amount: -A }, { accountId: r, amount: A } ], actorId }, outerTx);
    }
    // VENDOR_RECEIVABLE −A, VENDOR_PROFIT +A  (residual written off as a loss)
    case "VENDOR_WRITEOFF": {
      const v = await prisma.vendor.findFirst({ where: { name: payload.party } });
      if (!v) throw new Error(`Vendor "${payload.party ?? ""}" not found.`);
      const [r, pf] = await Promise.all([ensureVendorAccount(v.id, "VENDOR_RECEIVABLE"), ensureVendorAccount(v.id, "VENDOR_PROFIT")]);
      return postTransaction({ type, occurredAt, description: note, vendorId: v.id, lines: [ { accountId: r, amount: -A }, { accountId: pf, amount: A } ], actorId }, outerTx);
    }
    // TREASURY +A, VENDOR_RECEIVABLE −P, VENDOR_PROFIT −(A−P)  (P defaults 0 = bank interest)
    case "VENDOR_RETURN":
    case "CHIT_PAYOUT": {
      const v = await prisma.vendor.findFirst({ where: { name: payload.party } });
      if (!v) throw new Error(`Vendor "${payload.party ?? ""}" not found.`);
      const P = payload.principal ? rupeesToPaise(payload.principal) : 0n;
      if (P > A) throw new Error("Principal returned can't exceed the amount received.");
      const [t, r, pf] = await Promise.all([treasuryId(), ensureVendorAccount(v.id, "VENDOR_RECEIVABLE"), ensureVendorAccount(v.id, "VENDOR_PROFIT")]);
      // Drop any zero leg: P=0 (pure interest) → no receivable leg; P=A (capital only) → no profit leg.
      const lines = [ { accountId: t, amount: A }, { accountId: r, amount: -P }, { accountId: pf, amount: -(A - P) } ].filter((l) => l.amount !== 0n);
      return postTransaction({ type, occurredAt, description: note, vendorId: v.id, lines, actorId }, outerTx);
    }
    // Give a loan (§8/§14): TREASURY −A (cash to borrower), LOAN_RECEIVABLE +A. First hand-out
    // opens a Loan (rate snapshot); later hand-outs before it closes attach as further tranches.
    case "LOAN_TAKEN": {
      const { ms } = await withMember();
      const tId = await treasuryId();
      const holder = await prisma.ledgerAccount.findUnique({ where: { id: tId }, select: { balance: true } });
      if ((holder?.balance ?? 0n) < A) throw new Error("The treasurer doesn't hold enough cash to disburse this.");
      const limit = await loanLimitPaise();
      const existing = await prisma.loan.findFirst({ where: { membershipId: ms.id, status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
      const requestedAfter = (existing?.requestedAmount ?? 0n) + A;
      if (limit > 0n && requestedAfter > limit) throw new Error(`Loan limit is ${formatPaise(limit)} — this would reach ${formatPaise(requestedAfter)}.`);
      let newRateBps: number | null = null;
      if (!existing) {
        // Cooldown (§8): a NEW loan is blocked until loanCooldownMonths after the last one closed.
        const cooldownUntil = await cooldownEndsAt(ms.id);
        if (cooldownUntil && occurredAt < cooldownUntil) {
          throw new Error(`This member is in the post-loan cooldown until ${cooldownUntil.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}.`);
        }
        newRateBps = await currentLoanRateBps();
      }
      const lr = await ensureLoanReceivable(ms.id);
      // Loan create/update + posting + principal increment are one atomic unit: a crash between them
      // must not leave the loan and the ledger disagreeing on outstanding principal.
      return atomically(async (tx) => {
        const loan = existing
          ? await tx.loan.update({ where: { id: existing.id }, data: { requestedAmount: requestedAfter }, select: { id: true } })
          : await tx.loan.create({ data: { membershipId: ms.id, requestedAmount: A, principalOutstanding: 0n, monthlyRateBps: newRateBps ?? 100, startedAt: occurredAt, status: "ACTIVE" }, select: { id: true } });
        const txn = await postTransaction({ type, occurredAt, description: note, membershipId: ms.id, loanId: loan.id, lines: [ { accountId: tId, amount: -A }, { accountId: lr, amount: A } ], actorId }, tx);
        await tx.loan.update({ where: { id: loan.id }, data: { principalOutstanding: { increment: A } } });
        return txn;
      });
    }
    // Record repayment (§8): TREASURY +A (cash in), LOAN_RECEIVABLE −A. Clears the loan when the
    // outstanding principal hits zero. Interest is collected separately (LOAN_INTEREST).
    case "LOAN_REPAY": {
      const { ms } = await withMember();
      const loan = await prisma.loan.findFirst({ where: { membershipId: ms.id, status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
      if (!loan) throw new Error(`${payload.party} has no active loan to repay.`);
      if (A > loan.principalOutstanding) throw new Error(`Repayment exceeds the ${formatPaise(loan.principalOutstanding)} principal outstanding.`);
      const [tr, lr] = await Promise.all([treasuryId(), ensureLoanReceivable(ms.id)]);
      return atomically(async (tx) => {
        const txn = await postTransaction({ type, occurredAt, description: note, membershipId: ms.id, loanId: loan.id, lines: [ { accountId: tr, amount: A }, { accountId: lr, amount: -A } ], actorId }, tx);
        const remaining = loan.principalOutstanding - A;
        await tx.loan.update({ where: { id: loan.id }, data: { principalOutstanding: remaining, ...(remaining <= 0n ? { status: "CLOSED", closedAt: occurredAt } : {}) } });
        return txn;
      });
    }
    // Collect interest (§8/§9): TREASURY +A (cash in), INTEREST_INCOME −A. Doesn't touch principal;
    // it pools as club profit (shared per §11). Tagged to the membership so "interest paid" attributes.
    case "LOAN_INTEREST": {
      const { ms } = await withMember();
      const [t, inc] = await Promise.all([treasuryId(), ensureIncome("INTEREST_INCOME")]);
      return postTransaction({ type, occurredAt, description: note, membershipId: ms.id, lines: [ { accountId: t, amount: A }, { accountId: inc, amount: -A } ], actorId }, outerTx);
    }
    default:
      throw new Error(`Intent "${payload.intent}" is not wired.`);
  }
}

// Current monthly loan rate (bps) = latest entry of ClubConfig.rateSchedule (fixed at loan start, §14.2).
async function currentLoanRateBps(): Promise<number> {
  const cfg = await prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { rateSchedule: true } });
  const sched = (cfg?.rateSchedule as { rateBps: number }[] | undefined) ?? [];
  return sched.length ? sched[sched.length - 1].rateBps : 100;
}

// Current loan limit in paise (0 = unset → no cap).
async function loanLimitPaise(): Promise<bigint> {
  const cfg = await prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { maxLoanPaise: true } });
  return cfg?.maxLoanPaise ?? 0n;
}

// End of the post-loan cooldown for a membership (§8): loanCooldownMonths after the most recent
// loan closed. Null when the member has never had a closed loan (nothing to wait on).
async function cooldownEndsAt(membershipId: string): Promise<Date | null> {
  const [cfg, last] = await Promise.all([
    prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { loanCooldownMonths: true } }),
    prisma.loan.findFirst({ where: { membershipId, status: "CLOSED", closedAt: { not: null } }, orderBy: { closedAt: "desc" }, select: { closedAt: true } }),
  ]);
  const months = cfg?.loanCooldownMonths ?? 0;
  if (!last?.closedAt || months <= 0) return null;
  return addMonths(last.closedAt, months);
}
