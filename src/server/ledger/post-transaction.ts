import { prisma } from "@/server/db";
import { istDate } from "@/lib/date";
import type { Prisma, TxnType } from "@prisma/client";

export interface PostLine {
  accountId: string;
  amount: bigint; // signed paise
}

export interface PostInput {
  type: TxnType;
  occurredAt: Date;
  description?: string | null;
  membershipId?: string;
  loanId?: string;
  vendorId?: string;
  reversesId?: string;
  reference?: string; // groups related postings (e.g. all legs of one settlement share a settlementId)
  lines: PostLine[]; // must sum to 0, ≥2 legs, none zero
  actorId?: string;
}

/**
 * The single choke point for all balance changes (§12). Pure pre-validate, then one
 * atomic DB transaction: create the Transaction + Entries, increment cached balances,
 * enforce non-negative treasury (§12.1), write an audit row. Returns the txn id.
 *
 * Pass an outer `tx` to run inside a caller's transaction (so the posting and the caller's
 * side-effects commit atomically); omit it to open a fresh transaction. Never opens a nested
 * one — with an outer `tx` the same client is reused.
 */
export async function postTransaction(rawInput: PostInput, tx?: Prisma.TransactionClient): Promise<{ id: string }> {
  // Transactions are date-based (§11): normalize to the IST calendar date at UTC midnight, so
  // stored instants never carry a stray time-of-day whatever the caller passed.
  const input = { ...rawInput, occurredAt: istDate(rawInput.occurredAt) };
  const { lines } = input;
  if (lines.length < 2) throw new Error("A transaction needs at least two legs.");
  if (lines.some((l) => l.amount === 0n)) throw new Error("Ledger lines cannot be zero.");
  const sum = lines.reduce((s, l) => s + l.amount, 0n);
  if (sum !== 0n) throw new Error("Ledger lines must balance to zero.");

  const run = async (tx: Prisma.TransactionClient) => {
    const ids = [...new Set(lines.map((l) => l.accountId))];
    const accts = await tx.ledgerAccount.findMany({ where: { id: { in: ids } } });
    if (accts.length !== ids.length) throw new Error("Unknown ledger account in posting.");

    // §18: a closed quarter is locked — refuse any posting dated inside it (unless it's a reversal).
    if (!input.reversesId) {
      const locked = await tx.periodClose.findFirst({
        where: { periodStart: { lte: input.occurredAt }, periodEnd: { gte: input.occurredAt } },
        select: { id: true },
      });
      if (locked) throw new Error("That date falls in a closed quarter — its entries are locked.");
    }

    // Flag the original so every "live rows only" read can filter `reversed: false` (indexed)
    // instead of assembling a NOT-IN list of reversal targets on each query.
    if (input.reversesId)
      await tx.transaction.update({ where: { id: input.reversesId }, data: { reversed: true } });

    const txn = await tx.transaction.create({
      data: {
        type: input.type,
        occurredAt: input.occurredAt,
        description: input.description ?? null,
        membershipId: input.membershipId,
        loanId: input.loanId,
        vendorId: input.vendorId,
        reversesId: input.reversesId,
        reference: input.reference,
        createdById: input.actorId,
      },
    });
    await tx.entry.createMany({
      data: lines.map((l) => ({ transactionId: txn.id, accountId: l.accountId, amount: l.amount })),
    });
    for (const l of lines) {
      await tx.ledgerAccount.update({ where: { id: l.accountId }, data: { balance: { increment: l.amount } } });
    }

    // §12.1 non-negative treasury: a treasurer can't pay out cash they don't hold.
    const treasury = await tx.ledgerAccount.findMany({ where: { id: { in: ids }, kind: "TREASURY_CASH" } });
    if (treasury.some((t) => t.balance < 0n)) {
      throw new Error("A treasurer can't pay out cash they don't hold.");
    }

    await tx.auditLog.create({
      data: { action: input.type, entityType: "Transaction", entityId: txn.id, actorId: input.actorId, meta: {} },
    });
    return { id: txn.id };
  };

  return tx ? run(tx) : prisma.$transaction(run);
}
