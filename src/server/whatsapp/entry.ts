import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { rupeesToPaise, formatPaise } from "@/lib/money";
import { approveSubmission, rejectSubmission } from "@/server/ledger/approve";
import { syncAutoPenaltiesSafe } from "@/server/ledger/auto-penalties";
import { bustStats } from "@/server/stats";
import { matchMember, nameMatches, type WaSender } from "./identity";
import { parseEntryText, looksLikeEntryStart, entryMissing, VENDOR_ENTRY_INTENTS, OUTFLOW_INTENTS } from "./parse";
import { sendText, sendButtons } from "./send";

/**
 * WhatsApp money entries ride the EXISTING submit → approve machinery (PRODUCT.md §15):
 * every parsed command becomes a PENDING Submission. An admin gets Confirm/Cancel buttons
 * (Confirm = approveSubmission — idempotent, so a double-tap can't double-post); a member's
 * command queues for admin approval exactly like the web app.
 */

export const looksLikeEntry = (text: string) => looksLikeEntryStart(text);

const USAGE =
  "Format:\n*<member or vendor> <type> <amount> to <treasurer>*\n\n" +
  "Types: *paid* deposit · *repaid* loan repayment · *interest* interest collected · " +
  "*loan* loan given · *invest* vendor investment · *return* vendor return\n" +
  "Optional: *principal <amt>* (vendor return), *on 2026-07-01*, *note <anything>*\n\n" +
  "Example: *ravi paid 2000 to suresh note july deposit*";

/** Vendor-name match for invest/return entries — same full-name / word-prefix semantics as matchMember. */
async function matchVendor(q: string): Promise<{ vendor?: { name: string }; ambiguous?: string[] }> {
  const vendors = await prisma.vendor.findMany({ where: { archivedAt: null }, select: { name: true } });
  const hits = vendors.filter((v) => nameMatches(v.name, q));
  if (hits.length === 1) return { vendor: hits[0] };
  if (hits.length > 1) {
    const exact = hits.find((v) => v.name.toLowerCase() === q.trim().toLowerCase());
    return exact ? { vendor: exact } : { ambiguous: hits.map((v) => v.name) };
  }
  return {};
}

/** Parse an entry command, create the PENDING Submission, and reply with the confirm step. */
export async function startEntry(sender: WaSender, waId: string, text: string): Promise<void> {
  const p = parseEntryText(text);
  // Entry-shaped but incomplete → say exactly what's missing, then the format.
  if (!p) return sendText(waId, `Almost — I'm missing ${entryMissing(text)}.\n\n${USAGE}`);
  const { who, intent, amountRaw, treasurer: treasurerRaw, principal, date, note } = p;

  const paise = rupeesToPaise(amountRaw);
  if (paise <= 0n) return sendText(waId, "I couldn't read that amount. Try e.g. *ravi paid 2000 to suresh*.");

  // invest/return name a vendor; everything else names a member. postIntent resolves vendors by
  // exact name, so pass the canonical DB name through `party` (no partyId for vendors).
  let partyName: string;
  let partyId: string | undefined;
  if (VENDOR_ENTRY_INTENTS.has(intent)) {
    const v = await matchVendor(who);
    if (v.ambiguous) return sendText(waId, `Which vendor? ${v.ambiguous.join(", ")}`);
    if (!v.vendor) return sendText(waId, `No vendor matches "${who}".`);
    partyName = v.vendor.name;
  } else {
    const target = await matchMember(who);
    if (target.ambiguous) return sendText(waId, `Which one? ${target.ambiguous.join(", ")} — use the full name.`);
    if (!target.member) return sendText(waId, `No member matches "${who}".`);
    partyName = target.member.name;
    partyId = target.member.id;
  }

  const treasurer = (await matchMember(treasurerRaw)).member;
  if (!treasurer) return sendText(waId, `No member matches treasurer "${treasurerRaw}".`);

  const principalPaise = principal ? rupeesToPaise(principal) : null;
  if (principalPaise !== null && (principalPaise <= 0n || principalPaise > paise))
    return sendText(waId, "The principal must be more than zero and not more than the amount.");

  const payload: Record<string, string> = {
    party: partyName,
    ...(partyId ? { partyId } : {}),
    amount: (Number(paise) / 100).toString(),
    treasurer: treasurer.name,
    treasurerId: treasurer.id,
    note: note ? `${note} (via WhatsApp)` : "via WhatsApp",
    ...(principalPaise ? { principal: (Number(principalPaise) / 100).toString() } : {}),
    ...(date ? { date } : {}),
  };
  const sub = await prisma.submission.create({ data: { intent, payload, status: "PENDING", submittedById: sender.id } });

  const preview =
    `*${intent}*\n` +
    `${VENDOR_ENTRY_INTENTS.has(intent) ? "Vendor" : "Member"}: ${partyName}\n` +
    `Amount: ${formatPaise(paise)}\n` +
    (principalPaise ? `Principal part: ${formatPaise(principalPaise)}\n` : "") +
    `${OUTFLOW_INTENTS.has(intent) ? "Cash from" : "Cash to"}: ${treasurer.name}\n` +
    `Date: ${date ?? "today"}` +
    (note ? `\nNote: ${note}` : "");

  if (sender.isAdmin) {
    return sendButtons(waId, `Confirm entry?\n\n${preview}`, [
      { id: `wa:ok:${sub.id}`, title: "Confirm" },
      { id: `wa:no:${sub.id}`, title: "Cancel" },
    ]);
  }
  // Member: same as web — queue it and put an approval in every admin's inbox.
  const admins = await prisma.member.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await prisma.notification.createMany({
    data: admins.map((a) => ({
      recipientId: a.id, kind: "APPROVAL" as const, type: "submission.pending", title: intent,
      body: `${partyName} · ${formatPaise(paise)} (via WhatsApp)`, link: "/notifications", submissionId: sub.id,
    })),
  });
  revalidatePath("/notifications");
  return sendText(waId, `Sent for admin approval ✅\n\n${preview}`);
}

/** Button tap: "wa:ok:<subId>" posts via approveSubmission, "wa:no:<subId>" rejects. Admin-only. */
export async function decideEntry(sender: WaSender, waId: string, buttonId: string): Promise<void> {
  const m = /^wa:(ok|no):(.+)$/.exec(buttonId);
  if (!m) return sendText(waId, "That button has expired.");
  if (!sender.isAdmin) return sendText(waId, "Only an admin can confirm entries.");
  const [, verdict, subId] = m;
  try {
    if (verdict === "ok") {
      await approveSubmission(subId, sender.id);
      // Same post-mutation sweep as the web actions: penalties may newly apply, snapshots are stale.
      await syncAutoPenaltiesSafe();
      await bustStats();
      for (const p of ["/transactions", "/dashboard", "/members", "/vendors", "/analytics", "/notifications", "/penalties"]) revalidatePath(p);
      return sendText(waId, "✅ Recorded.");
    }
    await rejectSubmission(subId, sender.id);
    return sendText(waId, "❌ Cancelled — nothing was recorded.");
  } catch (e) {
    return sendText(waId, e instanceof Error ? e.message : "Could not process that.");
  }
}
