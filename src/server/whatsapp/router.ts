import "server-only";
import { getMemberDetail, type MemberDetailDTO } from "@/server/queries/members";
import { getTransactionsPage } from "@/server/queries/transactions";
import { matchMember, senderByWaId, type WaSender } from "./identity";
import { sendText } from "./send";
import { looksLikeEntry, startEntry, decideEntry } from "./entry";

/**
 * Inbound message → reply. Members read their own data; admins may target anyone
 * ("balance ravi") and record entries ("ravi paid 2000" — see entry.ts).
 */
export async function handleIncoming(waId: string, msg: { text?: string; buttonId?: string }): Promise<void> {
  const sender = await senderByWaId(waId);
  if (!sender) return sendText(waId, "This number isn't registered with Peacock. Ask an admin to add your WhatsApp number to your member profile.");

  if (msg.buttonId) return decideEntry(sender, waId, msg.buttonId);
  const text = msg.text?.trim() ?? "";
  if (!text) return;

  if (looksLikeEntry(text)) return startEntry(sender, waId, text);

  const [cmd, ...rest] = text.toLowerCase().split(/\s+/);
  const arg = rest.join(" ");

  // Admins can point a query at another member by name; everyone else always sees themself.
  const resolveTarget = async (): Promise<WaSender | string> => {
    if (!arg || !sender.isAdmin) return sender;
    const t = await matchMember(arg);
    if (t.ambiguous) return `Which one? ${t.ambiguous.join(", ")}`;
    return t.member ?? `No member matches "${arg}".`;
  };

  switch (cmd) {
    case "balance":
    case "loan":
    case "history":
    case "due": {
      const target = await resolveTarget();
      if (typeof target === "string") return sendText(waId, target);
      const d = await getMemberDetail(target.id);
      if (!d) return sendText(waId, "No record found.");
      const body = cmd === "balance" ? balanceText(d) : cmd === "loan" ? loanText(d) : cmd === "history" ? historyText(d) : dueText(d);
      return sendText(waId, body);
    }
    case "txns":
    case "transactions": {
      const target = await resolveTarget();
      if (typeof target === "string") return sendText(waId, target);
      // Admin's bare "txns" = the club's latest ledger rows; otherwise the target member's.
      const party = sender.isAdmin && !arg ? undefined : target.name;
      const page = await getTransactionsPage({ party, page: 1, size: 5 });
      if (!page.rows.length) return sendText(waId, "No transactions yet.");
      const lines = page.rows.map((t) => `${t.date} · ${t.what}\n${t.from.name} → ${t.to.name} · ${t.amount}`);
      return sendText(waId, `*Latest transactions*${party ? ` — ${party}` : ""}\n\n${lines.join("\n\n")}`);
    }
    default:
      return sendText(waId, helpText(sender));
  }
}

const orNone = (s: string | null) => s ?? "none 🎉";

function balanceText(d: MemberDetailDTO): string {
  return (
    `*${d.name}* — ${d.status}\n\n` +
    `Deposits paid: ${d.depositsTotal}\n` +
    `Profit share: ${d.profit}\n` +
    `Current value: ${d.value}\n` +
    `Pending: ${orNone(d.overallPending)}`
  );
}

function loanText(d: MemberDetailDTO): string {
  if (!d.hasLoans) return `*${d.name}*\n\nNo loans yet.`;
  return (
    `*${d.name} — loan*\n\n` +
    `Outstanding: ${d.currentLoan}\n` +
    `Interest due: ${d.interestDue}\n\n` +
    `Taken (all time): ${d.loanTaken}\n` +
    `Repaid: ${d.loanRepaid}\n` +
    `Interest paid: ${d.interestPaid}`
  );
}

function historyText(d: MemberDetailDTO): string {
  if (!d.cycles.length) return `*${d.name}*\n\nNo loan history.`;
  const rows = d.cycles.slice(-6).map((c) => `#${c.n} ${c.statusLabel} · ${c.amt}\n${c.start} → ${c.end} (${c.days}) · interest ${c.interest}`);
  return `*${d.name} — loan history*\n\n${rows.join("\n\n")}`;
}

function dueText(d: MemberDetailDTO): string {
  return (
    `*${d.name} — dues*\n\n` +
    `Deposit pending: ${orNone(d.depositPending)}\n` +
    `Catch-up remaining: ${d.ledgerRemaining}\n` +
    `Penalty remaining: ${d.penaltyRemaining}\n` +
    `Interest due: ${d.interestDue}\n\n` +
    `Total pending: ${orNone(d.overallPending)}`
  );
}

function helpText(sender: WaSender): string {
  const member =
    `Hi ${sender.name.split(" ")[0]}! I'm the Peacock club bot 🦚\n\n` +
    `*balance* — deposits, profit, value\n` +
    `*loan* — your loan & interest\n` +
    `*history* — loan history\n` +
    `*txns* — latest transactions\n` +
    `*due* — what you owe`;
  if (!sender.isAdmin) return member;
  return (
    member +
    `\n\n*Admin*\nAdd a name to any command: *balance ravi*\n\n` +
    `Record entries:\n` +
    `• *ravi paid 2000* — deposit\n` +
    `• *ravi repaid 5000* — loan repayment\n` +
    `• *ravi interest 500* — collect interest\n` +
    `Optional: *to <treasurer>*, *on 2026-07-01*`
  );
}
