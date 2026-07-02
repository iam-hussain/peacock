import { prisma } from "@/server/db";
import type { TxnType } from "@prisma/client";

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
  lines: PostLine[]; // must sum to 0, ≥2 legs, none zero
  actorId?: string;
}

/**
 * The single choke point for all balance changes (§12). Pure pre-validate, then one
 * atomic DB transaction: create the Transaction + Entries, increment cached balances,
 * enforce non-negative treasury (§12.1), write an audit row. Returns the txn id.
 */
export async function postTransaction(input: PostInput): Promise<{ id: string }> {
  const { lines } = input;
  if (lines.length < 2) throw new Error("A transaction needs at least two legs.");
  if (lines.some((l) => l.amount === 0n)) throw new Error("Ledger lines cannot be zero.");
  const sum = lines.reduce((s, l) => s + l.amount, 0n);
  if (sum !== 0n) throw new Error("Ledger lines must balance to zero.");

  return prisma.$transaction(async (tx) => {
    const ids = [...new Set(lines.map((l) => l.accountId))];
    const accts = await tx.ledgerAccount.findMany({ where: { id: { in: ids } } });
    if (accts.length !== ids.length) throw new Error("Unknown ledger account in posting.");

    const txn = await tx.transaction.create({
      data: {
        type: input.type,
        occurredAt: input.occurredAt,
        description: input.description ?? null,
        membershipId: input.membershipId,
        loanId: input.loanId,
        vendorId: input.vendorId,
        reversesId: input.reversesId,
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
  });
}
