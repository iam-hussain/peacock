import { prisma } from "@/server/db";
import { profitShare } from "@/lib/money";
import { istDate } from "@/lib/date";
import { ensureTreasury, ensureEquity, ensureIncome, ensureLoanReceivable, ensureProfitDistributed } from "./accounts";
import { postTransaction } from "./post-transaction";
import { shareableClubProfit, expectedClubDeposit, type Stage } from "@/server/queries/members";
import { interestOwedForMembership } from "@/server/queries/loans";

// The settlement guide (§12), all integer paise. `paid` is the admin-entered final amount; the
// rest is the server-authoritative breakdown at settle time. Persisted on Membership.settledGuide
// (as strings, since JSON can't hold BigInt) so a closed account can show exactly what happened.
export interface SettlementGuide {
  capital: bigint; // paid-in capital returned (deposits + catch-up)
  profit: bigint; // profit share (§11)
  loan: bigint; // loan principal still outstanding
  interest: bigint; // unpaid loan interest
  suggested: bigint; // capital + profit − loan − interest (floored ≥0)
}

/** Server-authoritative settlement breakdown for an active membership (§12). */
export async function computeSettlement(membershipId: string): Promise<SettlementGuide> {
  const equity = await prisma.ledgerAccount.findFirst({ where: { membershipId, kind: "MEMBER_EQUITY" }, select: { balance: true } });
  const capital = -(equity?.balance ?? 0n); // equity holds deposits+catch-up as a negative balance
  const cfg = await prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { stages: true } });
  const expectedDeposit = expectedClubDeposit((cfg?.stages as Stage[] | undefined) ?? []);
  const activeCount = await prisma.membership.count({ where: { status: "ACTIVE" } });
  const profit = profitShare(await shareableClubProfit(), capital, activeCount, expectedDeposit);
  const loan = (await prisma.loan.aggregate({ _sum: { principalOutstanding: true }, where: { membershipId, status: "ACTIVE" } }))._sum.principalOutstanding ?? 0n;
  const interest = await interestOwedForMembership(membershipId);
  const suggested = capital + profit - loan - interest;
  return { capital, profit, loan, interest, suggested: suggested > 0n ? suggested : 0n };
}

/**
 * Settle & close a membership (§12) as REAL ledger events instead of one lump (see PRODUCT.md §12):
 *   1. LOAN_INTEREST — collect unpaid interest (recognized as income → pending clears)
 *   2. LOAN_REPAY    — clear outstanding principal (closes the loan)
 *   3. WITHDRAW      — return capital (equity → 0)
 *   4. PROFIT_WITHDRAW — pay profit (→ PROFIT_DISTRIBUTED, so it leaves the shareable pool)
 * All four share one `reference` so the settlement guide is reconstructable. Cash-in legs post
 * first so the treasurer never dips negative. If the admin pays below the guide, the shortfall
 * comes off profit first, then capital (dues are always cleared in full).
 */
export async function settleMembership(params: {
  membershipId: string;
  treasurerMemberId: string;
  finalPaise: bigint;
  occurredAt: Date;
  note?: string | null;
  actorId?: string;
}): Promise<SettlementGuide & { paid: bigint }> {
  const { membershipId, treasurerMemberId, finalPaise, note, actorId } = params;
  const occurredAt = istDate(params.occurredAt); // date-based, like all transactions
  if (finalPaise <= 0n) throw new Error("Settlement amount must be greater than zero.");
  const g = await computeSettlement(membershipId);
  const reference = `settle:${membershipId}:${occurredAt.getTime()}`;

  const treasury = await ensureTreasury(treasurerMemberId);
  const held = (await prisma.ledgerAccount.findUnique({ where: { id: treasury }, select: { balance: true } }))?.balance ?? 0n;
  if (held < finalPaise) throw new Error("The chosen treasurer doesn't hold enough cash for this payout.");

  // Allocate the payout: dues (interest + loan) are always cleared in full; the cash the member
  // actually receives goes to capital first, then profit — so paying under the guide forgoes profit.
  const grossToMember = finalPaise + g.interest + g.loan; // = capitalReturned + profitPaid
  const capitalReturned = grossToMember < g.capital ? grossToMember : g.capital;
  const profitPaid = grossToMember - capitalReturned;

  const loanRow = await prisma.loan.findFirst({ where: { membershipId, status: "ACTIVE" }, orderBy: { startedAt: "desc" }, select: { id: true } });

  // Resolve the accounts up-front (creates are idempotent), then commit every posting, the loan
  // close, and the membership close in ONE transaction — a crash mid-settlement must not leave the
  // ledger half-posted with the membership still open or the loan still active.
  const inc = g.interest > 0n ? await ensureIncome("INTEREST_INCOME") : null;
  const lr = g.loan > 0n && loanRow ? await ensureLoanReceivable(membershipId) : null;
  const eq = capitalReturned > 0n ? await ensureEquity(membershipId) : null;
  const pd = profitPaid > 0n ? await ensureProfitDistributed() : null;

  await prisma.$transaction(async (tx) => {
    // 1) collect unpaid interest (cash-in)
    if (inc) {
      await postTransaction({ type: "LOAN_INTEREST", occurredAt, description: note ?? "Settlement — interest cleared", membershipId, loanId: loanRow?.id, reference, lines: [{ accountId: treasury, amount: g.interest }, { accountId: inc, amount: -g.interest }], actorId }, tx);
    }
    // 2) clear outstanding principal (cash-in) + close the loan
    if (lr && loanRow) {
      await postTransaction({ type: "LOAN_REPAY", occurredAt, description: note ?? "Settlement — loan cleared", membershipId, loanId: loanRow.id, reference, lines: [{ accountId: treasury, amount: g.loan }, { accountId: lr, amount: -g.loan }], actorId }, tx);
      await tx.loan.update({ where: { id: loanRow.id }, data: { principalOutstanding: 0n, status: "CLOSED", closedAt: occurredAt } });
    }
    // 3) return capital (cash-out)
    if (eq) {
      await postTransaction({ type: "WITHDRAW", occurredAt, description: note ?? "Settlement — capital returned", membershipId, reference, lines: [{ accountId: treasury, amount: -capitalReturned }, { accountId: eq, amount: capitalReturned }], actorId }, tx);
    }
    // 4) pay profit (cash-out) → contra-income pool
    if (pd) {
      await postTransaction({ type: "PROFIT_WITHDRAW", occurredAt, description: note ?? "Settlement — profit paid", membershipId, reference, lines: [{ accountId: treasury, amount: -profitPaid }, { accountId: pd, amount: profitPaid }], actorId }, tx);
    }

    await tx.membership.update({
      where: { id: membershipId },
      data: {
        status: "CLOSED",
        leftAt: occurredAt,
        settledAmount: finalPaise,
        settledGuide: { capital: g.capital.toString(), profit: g.profit.toString(), loan: g.loan.toString(), interest: g.interest.toString(), suggested: g.suggested.toString(), paid: finalPaise.toString() },
      },
    });
  });
  return { ...g, paid: finalPaise };
}
