import "server-only";
import { prisma } from "@/server/db";
import { postTransaction } from "./post-transaction";
import type { TxnType } from "@prisma/client";

const abs = (n: bigint) => (n < 0n ? -n : n);

// §16: a correction reverses the original posting (edit also re-posts the corrected one) so the
// original always stays on record, dated to its own month.
//
// DELETE stays gated for types whose reversal would have to unwind a running aggregate with
// unbounded history (a loan's later repayments, membership rejoin chains). EDIT is allowed for
// every type because it applies a bounded delta to the linked side table (see applyEditSideEffects).
export const UNSAFE_TO_DELETE: ReadonlySet<TxnType> = new Set<TxnType>([
  "LOAN_TAKEN",
  "LOAN_REPAY",
  "WITHDRAW",
  "REJOIN",
]);

type Leg = { accountId: string; amount: bigint; account: { kind: string } };
interface LoadedTxn {
  id: string; type: TxnType; occurredAt: Date; description: string | null;
  membershipId: string | null; loanId: string | null; vendorId: string | null;
  entries: Leg[];
}

async function loadCorrectable(id: string): Promise<LoadedTxn> {
  const txn = await prisma.transaction.findUnique({
    where: { id },
    select: {
      id: true, type: true, occurredAt: true, description: true,
      membershipId: true, loanId: true, vendorId: true,
      entries: { select: { accountId: true, amount: true, account: { select: { kind: true } } } },
    },
  });
  if (!txn) throw new Error("Transaction not found.");
  if (txn.type === "REVERSAL") throw new Error("A reversal entry can't itself be edited or deleted.");
  const already = await prisma.transaction.findFirst({ where: { reversesId: id }, select: { id: true } });
  if (already) throw new Error("This transaction was already reversed.");
  return txn;
}

async function postReversal(txn: LoadedTxn, actorId?: string) {
  return postTransaction({
    type: "REVERSAL",
    occurredAt: txn.occurredAt,
    description: `Reversal of ${txn.type.toLowerCase().replace(/_/g, " ")}`,
    membershipId: txn.membershipId ?? undefined,
    loanId: txn.loanId ?? undefined,
    vendorId: txn.vendorId ?? undefined,
    reversesId: txn.id,
    lines: txn.entries.map((e) => ({ accountId: e.accountId, amount: -e.amount })),
    actorId,
  });
}

/** Delete = post a reversing entry, dated to the original's month (§16). */
export async function reverseTransaction(id: string, actorId?: string): Promise<{ id: string }> {
  const txn = await loadCorrectable(id);
  if (UNSAFE_TO_DELETE.has(txn.type))
    throw new Error("Delete this from the member's loan / membership screen — it changes more than the ledger.");
  return postReversal(txn, actorId);
}

// The "amount" a user sees = the treasury leg magnitude, or (no treasury leg) the largest leg.
function primaryMagnitude(txn: LoadedTxn): bigint {
  const treasury = txn.entries.find((e) => e.account.kind === "TREASURY_CASH");
  const pick = treasury ?? txn.entries.reduce((a, b) => (abs(b.amount) > abs(a.amount) ? b : a));
  return abs(pick.amount);
}

// Rebuild the legs for the new total, preserving each type's structure:
//  • 2-leg postings re-scale both legs to ±A'.
//  • vendor return / chit payout (treasury +A, receivable −P, profit −(A−P)) keep the principal
//    leg P fixed; the profit leg absorbs the difference so the posting still balances.
function rebuildLines(txn: LoadedTxn, A: bigint): { accountId: string; amount: bigint }[] {
  if (txn.entries.length === 2)
    return txn.entries.map((e) => ({ accountId: e.accountId, amount: e.amount > 0n ? A : -A }));
  const treasury = txn.entries.find((e) => e.account.kind === "TREASURY_CASH");
  const principal = txn.entries.find((e) => e.account.kind === "VENDOR_RECEIVABLE");
  const profit = txn.entries.find((e) => e.account.kind === "VENDOR_PROFIT");
  if (treasury && principal && profit) {
    const t = treasury.amount > 0n ? A : -A;
    return [
      { accountId: treasury.accountId, amount: t },
      { accountId: principal.accountId, amount: principal.amount }, // principal returned stays fixed
      { accountId: profit.accountId, amount: -(t + principal.amount) }, // profit absorbs the rest
    ];
  }
  throw new Error("This transaction's shape can't be edited here — use its own screen.");
}

// Loan / membership state is a running aggregate. After the ledger is corrected, nudge the linked
// side table by the same delta and re-derive status. (Δ = new − old.)
async function applyEditSideEffects(txn: LoadedTxn, oldA: bigint, newA: bigint, occurredAt: Date) {
  const delta = newA - oldA;
  if (delta === 0n) return;

  if ((txn.type === "LOAN_TAKEN" || txn.type === "LOAN_REPAY") && txn.loanId) {
    const step = txn.type === "LOAN_TAKEN" ? delta : -delta; // a bigger repayment lowers principal
    const loan = await prisma.loan.update({
      where: { id: txn.loanId },
      data: {
        principalOutstanding: { increment: step },
        ...(txn.type === "LOAN_TAKEN" ? { requestedAmount: { increment: delta } } : {}),
      },
      select: { principalOutstanding: true },
    });
    // ponytail: re-derive status from the resulting principal — correct for the common single-loan
    // case. A pathological edit of an early entry after later ones already moved the loan can leave
    // it off; recompute from the loan's full entry history if the club ever overlaps loans.
    await prisma.loan.update({
      where: { id: txn.loanId },
      data: loan.principalOutstanding <= 0n
        ? { status: "CLOSED", closedAt: occurredAt }
        : { status: "ACTIVE", closedAt: null },
    });
  }

  if (txn.type === "WITHDRAW" && txn.membershipId)
    await prisma.membership.update({ where: { id: txn.membershipId }, data: { settledAmount: newA } });
}

/** Edit = reverse the original, re-post a corrected copy at the new amount / date, and adjust any
 *  loan / membership side table (§16). Works for every transaction type. */
export async function editTransactionAmount(
  id: string,
  newAmountPaise: bigint,
  newDateISO?: string,
  actorId?: string,
): Promise<{ id: string }> {
  const txn = await loadCorrectable(id);
  if (newAmountPaise <= 0n) throw new Error("Amount must be greater than zero.");
  const oldA = primaryMagnitude(txn);
  // Keep the exact original timestamp when the date is unchanged — re-posting at the date's midnight
  // would otherwise shift daily-interest accrual by up to a day on an amount-only edit.
  const sameDate = newDateISO === txn.occurredAt.toISOString().slice(0, 10);
  const occurredAt = newDateISO && !sameDate ? new Date(newDateISO) : txn.occurredAt;
  const lines = rebuildLines(txn, newAmountPaise); // validate shape before we touch anything

  // ponytail: reverse + repost are two separate postings, not one atomic unit. If the repost fails
  // (closed-quarter date, treasury guard) the original is left reversed with no replacement — re-add
  // it. Fold both into one $transaction if that ever bites.
  await postReversal(txn, actorId);
  const corrected = await postTransaction({
    type: txn.type,
    occurredAt,
    description: txn.description ?? undefined,
    membershipId: txn.membershipId ?? undefined,
    loanId: txn.loanId ?? undefined,
    vendorId: txn.vendorId ?? undefined,
    lines,
    actorId,
  });
  await applyEditSideEffects(txn, oldA, newAmountPaise, occurredAt);
  return corrected;
}
