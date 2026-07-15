import { prisma } from "@/server/db";
import { postIntent, type EntryPayload } from "./intents";

/**
 * Approve a pending Submission → run the matching posting service and link the
 * created Transaction. The ledger only ever contains APPROVED, posted entries (§ schema note).
 */
export async function approveSubmission(id: string, actorId: string): Promise<{ id: string; txnId: string }> {
  const sub = await prisma.submission.findUnique({ where: { id } });
  if (!sub) throw new Error("Submission not found.");
  if (sub.status !== "PENDING") {
    // Idempotent: a retry after a successful approve must not double-post. If it already posted,
    // return the recorded transaction instead of posting a second one.
    if (sub.status === "APPROVED" && sub.postedTxnId) return { id, txnId: sub.postedTxnId };
    throw new Error("This submission was already decided.");
  }

  const rawPayload = sub.payload as Record<string, string>;
  const payload = { intent: sub.intent, ...rawPayload } as EntryPayload;
  // Post the ledger entries and flip the submission to APPROVED atomically: a crash between them
  // must not leave a posted transaction with the submission still PENDING (which a retry would re-post).
  return prisma.$transaction(async (tx) => {
    const txn = await postIntent(payload, actorId, tx);
    // A WhatsApp entry may carry a proof image (data URL) on its payload — land it on the posted
    // transaction now that we have its id. Metadata only; never touches the ledger balances.
    if (rawPayload.attachment) await tx.transaction.update({ where: { id: txn.id }, data: { attachment: rawPayload.attachment } });
    await tx.submission.update({
      where: { id },
      data: { status: "APPROVED", decidedById: actorId, decidedAt: new Date(), postedTxnId: txn.id },
    });
    await tx.notification.updateMany({ where: { submissionId: id }, data: { isRead: true } });
    return { id, txnId: txn.id };
  });
}

export async function rejectSubmission(id: string, actorId: string): Promise<{ id: string }> {
  const sub = await prisma.submission.findUnique({ where: { id } });
  if (!sub) throw new Error("Submission not found.");
  if (sub.status !== "PENDING") throw new Error("This submission was already decided.");
  await prisma.submission.update({
    where: { id },
    data: { status: "REJECTED", decidedById: actorId, decidedAt: new Date() },
  });
  await prisma.notification.updateMany({ where: { submissionId: id }, data: { isRead: true } });
  return { id };
}
