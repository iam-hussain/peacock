import { prisma } from "@/server/db";
import { postIntent, type EntryPayload } from "./intents";

/**
 * Approve a pending Submission → run the matching posting service and link the
 * created Transaction. The ledger only ever contains APPROVED, posted entries (§ schema note).
 */
export async function approveSubmission(id: string, actorId: string): Promise<{ id: string; txnId: string }> {
  const sub = await prisma.submission.findUnique({ where: { id } });
  if (!sub) throw new Error("Submission not found.");
  if (sub.status !== "PENDING") throw new Error("This submission was already decided.");

  const payload = { intent: sub.intent, ...(sub.payload as Record<string, string>) } as EntryPayload;
  const txn = await postIntent(payload, actorId);

  await prisma.submission.update({
    where: { id },
    data: { status: "APPROVED", decidedById: actorId, decidedAt: new Date(), postedTxnId: txn.id },
  });
  await prisma.notification.updateMany({ where: { submissionId: id }, data: { isRead: true } });
  return { id, txnId: txn.id };
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
