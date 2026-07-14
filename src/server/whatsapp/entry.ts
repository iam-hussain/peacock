import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { rupeesToPaise, formatPaise } from "@/lib/money";
import { approveSubmission, rejectSubmission } from "@/server/ledger/approve";
import { syncAutoPenaltiesSafe } from "@/server/ledger/auto-penalties";
import { bustStats } from "@/server/stats";
import { raiseCharge } from "@/server/ledger/charges";
import { matchMember, nameMatches, type WaSender } from "./identity";
import { parseEntryText, parseChargeText, looksLikeEntryStart, entryMissing, VENDOR_ENTRY_INTENTS, OUTFLOW_INTENTS } from "./parse";
import { sendText, sendButtons } from "./send";

/**
 * WhatsApp money entries ride the EXISTING submit → approve machinery (PRODUCT.md §15):
 * every parsed command becomes a PENDING Submission. An admin gets Confirm/Cancel buttons
 * (Confirm = approveSubmission — idempotent, so a double-tap can't double-post); a member's
 * command queues for admin approval exactly like the web app.
 */

export const looksLikeEntry = (text: string) => looksLikeEntryStart(text);

const USAGE =
  "✍️ *Record an entry*\n_<member/vendor> <type> <amount> to <treasurer>_\n\n" +
  "Types: *paid* deposit · *repaid* loan repayment · *interest* interest collected · " +
  "*loan* loan given · *invest* vendor investment · *return* vendor return · " +
  "*catchup* catch-up payment · *penalty* penalty payment\n" +
  "Optional: *principal <amt>* (vendor return), *on 2026-07-01*, *note <anything>*\n\n" +
  "e.g. *ravi paid 2000 to suresh note july deposit*";

const CHARGE_USAGE =
  "🛡️ *Raise a charge* (admin)\n_charge <member> <catchup|penalty> <amount>_\n" +
  "Optional: *on 2026-07-01*, *note <anything>*\n\n" +
  "e.g. *charge ravi penalty 500 note late June deposit*";

// Intent → a little icon for the preview header (a touch of visual scanning).
const INTENT_ICON: Record<string, string> = {
  "Member paid deposit": "💵",
  "Catch-up payment": "🔄",
  "Delayed-payment penalty": "⚠️",
  "Record repayment": "💸",
  "Collect interest": "📈",
  "Give a loan": "🏦",
  "Vendor investment": "📤",
  "Vendor return": "📥",
};

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
  if (!p) return sendText(waId, `✍️ Almost — I'm missing ${entryMissing(text)}.\n\n${USAGE}`);
  const { who, intent, amountRaw, treasurer: treasurerRaw, principal, date, note } = p;

  const paise = rupeesToPaise(amountRaw);
  if (paise <= 0n) return sendText(waId, "⚠️ I couldn't read that amount. Try e.g. *ravi paid 2000 to suresh*.");

  // invest/return name a vendor; everything else names a member. postIntent resolves vendors by
  // exact name, so pass the canonical DB name through `party` (no partyId for vendors).
  let partyName: string;
  let partyId: string | undefined;
  if (VENDOR_ENTRY_INTENTS.has(intent)) {
    const v = await matchVendor(who);
    if (v.ambiguous) return sendText(waId, `🤔 Which vendor? ${v.ambiguous.join(", ")}`);
    if (!v.vendor) return sendText(waId, `⚠️ No vendor matches "${who}".`);
    partyName = v.vendor.name;
  } else {
    const target = await matchMember(who);
    if (target.ambiguous) return sendText(waId, `🤔 Which one? ${target.ambiguous.join(", ")} — use the full name.`);
    if (!target.member) return sendText(waId, `⚠️ No member matches "${who}".\n\nSend *members* to see who's registered.`);
    partyName = target.member.name;
    partyId = target.member.id;
  }

  const treasurer = (await matchMember(treasurerRaw)).member;
  if (!treasurer) return sendText(waId, `⚠️ No member matches treasurer "${treasurerRaw}".`);

  const principalPaise = principal ? rupeesToPaise(principal) : null;
  if (principalPaise !== null && (principalPaise <= 0n || principalPaise > paise))
    return sendText(waId, "⚠️ The principal must be more than zero and not more than the amount.");

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

  const preview = submissionPreview(intent, payload);

  if (sender.isAdmin) {
    return sendButtons(waId, `❓ *Confirm this entry?*\n\n${preview}`, [
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
  return sendText(waId, `✅ *Sent for admin approval*\n\n${preview}`);
}

/** Human-readable preview of a submission's payload — shared by the submit confirmation and the
 *  admin pending list. Pass `submittedBy` to append who queued it (admin review only). */
function submissionPreview(intent: string, payload: Record<string, string>, submittedBy?: string): string {
  const paise = rupeesToPaise(payload.amount ?? "0");
  const principalPaise = payload.principal ? rupeesToPaise(payload.principal) : null;
  // payload.note carries a "(via WhatsApp)" marker for the audit trail — strip it for display.
  const rawNote = payload.note ?? "";
  const note = rawNote === "via WhatsApp" ? "" : rawNote.replace(/\s*\(via WhatsApp\)$/i, "").trim();
  return (
    `${INTENT_ICON[intent] ?? "✍️"} *${intent}*\n` +
    `${VENDOR_ENTRY_INTENTS.has(intent) ? "Vendor" : "Member"}: ${payload.party}\n` +
    `Amount: *${formatPaise(paise)}*\n` +
    (principalPaise ? `Principal part: ${formatPaise(principalPaise)}\n` : "") +
    `${OUTFLOW_INTENTS.has(intent) ? "Cash from" : "Cash to"}: ${payload.treasurer}\n` +
    `Date: ${payload.date ?? "today"}` +
    (note ? `\nNote: ${note}` : "") +
    (submittedBy ? `\n👤 From: ${submittedBy}` : "")
  );
}

/** Admin: raise a catch-up or penalty CHARGE on a member (the obligation, no treasurer/approval —
 *  admins post charges directly in the app too). "charge ravi penalty 500 note late". */
export async function raiseChargeEntry(sender: WaSender, waId: string, text: string): Promise<void> {
  if (!sender.isAdmin) return sendText(waId, "🔒 Only an admin can raise a catch-up or penalty charge.");
  const p = parseChargeText(text);
  if (!p) return sendText(waId, `⚠️ I couldn't read that charge.\n\n${CHARGE_USAGE}`);
  const paise = rupeesToPaise(p.amountRaw);
  if (paise <= 0n) return sendText(waId, "⚠️ I couldn't read that amount. Try e.g. *charge ravi penalty 500*.");

  const target = await matchMember(p.who);
  if (target.ambiguous) return sendText(waId, `🤔 Which one? ${target.ambiguous.join(", ")} — use the full name.`);
  if (!target.member) return sendText(waId, `⚠️ No member matches "${p.who}".\n\nSend *members* to see who's registered.`);
  const ms = await prisma.membership.findFirst({ where: { memberId: target.member.id, status: "ACTIVE" }, orderBy: { seq: "desc" }, select: { id: true } });
  if (!ms) return sendText(waId, `⚠️ ${target.member.name} has no active membership to charge.`);

  await raiseCharge({ membershipId: ms.id, kind: p.kind, amountPaise: paise, note: p.note ? `${p.note} (via WhatsApp)` : "via WhatsApp", date: p.date });
  for (const path of ["/members", `/members/${target.member.id}`, "/penalties", "/dashboard"]) revalidatePath(path);

  const label = p.kind === "PENALTY" ? "Penalty" : "Catch-up";
  const icon = p.kind === "PENALTY" ? "⚠️" : "🔄";
  return sendText(
    waId,
    `✅ *${label} charge raised*\n\n` +
      `${icon} Member: ${target.member.name}\n` +
      `Amount: *${formatPaise(paise)}*\n` +
      `Date: ${p.date ?? "today"}` +
      (p.note ? `\nNote: ${p.note}` : ""),
  );
}

/** Admin: pull up PENDING submissions with per-entry Approve/Reject buttons (reuses decideEntry). */
export async function listPending(sender: WaSender, waId: string): Promise<void> {
  if (!sender.isAdmin) return sendText(waId, "🔒 Only an admin can review pending entries.");
  const CAP = 10;
  const [subs, total] = await Promise.all([
    prisma.submission.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: CAP,
      select: { id: true, intent: true, payload: true, submittedById: true },
    }),
    prisma.submission.count({ where: { status: "PENDING" } }),
  ]);
  if (!subs.length) return sendText(waId, "✅ No pending entries — all caught up!");
  const submitterIds = [...new Set(subs.map((s) => s.submittedById))];
  const submitters = await prisma.member.findMany({ where: { id: { in: submitterIds } }, select: { id: true, firstName: true, lastName: true } });
  const nameById = new Map(submitters.map((m) => [m.id, [m.firstName, m.lastName].filter(Boolean).join(" ")]));
  await sendText(waId, `📥 *Pending approvals* — ${total}${total > subs.length ? ` _(showing oldest ${subs.length})_` : ""}`);
  for (const s of subs) {
    const preview = submissionPreview(s.intent, s.payload as Record<string, string>, nameById.get(s.submittedById));
    await sendButtons(waId, preview, [
      { id: `wa:ok:${s.id}`, title: "Approve" },
      { id: `wa:no:${s.id}`, title: "Reject" },
    ]);
  }
}

/** Button tap: "wa:ok:<subId>" posts via approveSubmission, "wa:no:<subId>" rejects. Admin-only. */
export async function decideEntry(sender: WaSender, waId: string, buttonId: string): Promise<void> {
  const m = /^wa:(ok|no):(.+)$/.exec(buttonId);
  if (!m) return sendText(waId, "⚠️ That button has expired.");
  if (!sender.isAdmin) return sendText(waId, "🔒 Only an admin can confirm entries.");
  const [, verdict, subId] = m;
  try {
    if (verdict === "ok") {
      await approveSubmission(subId, sender.id);
      // Same post-mutation sweep as the web actions: penalties may newly apply, snapshots are stale.
      await syncAutoPenaltiesSafe();
      await bustStats();
      for (const p of ["/transactions", "/dashboard", "/members", "/vendors", "/analytics", "/notifications", "/penalties"]) revalidatePath(p);
      return sendText(waId, "✅ *Recorded.*");
    }
    await rejectSubmission(subId, sender.id);
    return sendText(waId, "❌ *Cancelled* — nothing was recorded.");
  } catch (e) {
    return sendText(waId, `⚠️ ${e instanceof Error ? e.message : "Could not process that."}`);
  }
}
