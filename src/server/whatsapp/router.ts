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
  const resolveTarget = async (nameArg: string): Promise<WaSender | string> => {
    if (!nameArg || !sender.isAdmin) return sender;
    const t = await matchMember(nameArg);
    if (t.ambiguous) return `Which one? ${t.ambiguous.join(", ")}`;
    return t.member ?? `No member matches "${nameArg}".`;
  };

  switch (cmd) {
    case "balance":
    case "loan":
    case "history":
    case "due": {
      const target = await resolveTarget(arg);
      if (typeof target === "string") return sendText(waId, target);
      const d = await getMemberDetail(target.id);
      if (!d) return sendText(waId, "No record found.");
      const body = cmd === "balance" ? balanceText(d) : cmd === "loan" ? loanText(d) : cmd === "history" ? historyText(d) : dueText(d);
      return sendText(waId, body);
    }
    case "txns":
    case "transactions": {
      const period = extractPeriod(arg);
      const target = await resolveTarget(period.rest);
      if (typeof target === "string") return sendText(waId, target);
      // Admin's bare "txns" = the club's latest ledger rows; otherwise the target member's.
      const party = sender.isAdmin && !period.rest ? undefined : target.name;
      const page = await getTransactionsPage({ party, start: period.start, end: period.end, page: 1, size: period.start ? 20 : 5 });
      if (!page.rows.length) return sendText(waId, `No transactions${party ? ` for ${party}` : ""}${period.label ? ` ${period.label}` : ""}.`);
      const lines = page.rows.map((t) => `${t.date} · ${t.what}\n${t.from.name} → ${t.to.name} · ${t.amount}`);
      const more = page.total > page.rows.length ? `\n\nShowing ${page.rows.length} of ${page.total} — open the app for the rest.` : "";
      return sendText(waId, `*Transactions*${party ? ` — ${party}` : ""}${period.label ? ` ${period.label}` : " (latest)"}\n\n${lines.join("\n\n")}${more}`);
    }
    default:
      return sendText(waId, helpText(sender));
  }
}

const orNone = (s: string | null) => s ?? "none 🎉";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Pull an optional period out of a txns argument: "on 2026-07-01" (one day), "july [2026]" or
 *  "2026-07" (whole month). Whatever remains is the member-name part. */
function extractPeriod(arg: string): { start?: string; end?: string; label?: string; rest: string } {
  const day = /(?:^|\s)on\s+(\d{4}-\d{2}-\d{2})(?:\s|$)/i.exec(arg);
  if (day) return { start: day[1], end: day[1], label: `on ${day[1]}`, rest: arg.replace(day[0], " ").trim() };

  const ym = /(?:^|\s)(\d{4})-(\d{2})(?:\s|$)/.exec(arg);
  if (ym) return { ...monthBounds(Number(ym[1]), Number(ym[2]) - 1), rest: arg.replace(ym[0], " ").trim() };

  for (const [i, m] of MONTHS.entries()) {
    const re = new RegExp(`(?:^|\\s)(${m.slice(0, 3)}[a-z]*)(?:\\s+(\\d{4}))?(?:\\s|$)`, "i");
    const hit = re.exec(arg);
    if (hit && (m.startsWith(hit[1].toLowerCase()) || hit[1].toLowerCase() === m.slice(0, 3))) {
      const year = hit[2] ? Number(hit[2]) : new Date().getFullYear();
      return { ...monthBounds(year, i), rest: arg.replace(hit[0], " ").trim() };
    }
  }
  return { rest: arg.trim() };
}

function monthBounds(year: number, monthIdx: number): { start: string; end: string; label: string } {
  const mm = String(monthIdx + 1).padStart(2, "0");
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-31`, label: `in ${MONTHS[monthIdx][0].toUpperCase()}${MONTHS[monthIdx].slice(1)} ${year}` };
}

function balanceText(d: MemberDetailDTO): string {
  return (
    `*${d.name}* — ${d.status}\n\n` +
    `Deposits paid: ${d.depositsTotal}\n` +
    `Profit share: ${d.profit}\n` +
    `Current value: ${d.value}\n` +
    `Pending: ${orNone(d.overallPending)}` +
    (d.held ? `\n\nClub cash held (treasury): ${d.held}` : "")
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
  const intro =
    `Hi ${sender.name.split(" ")[0]}! I'm the *Peacock Investment Club* bot 🦚\n\n` +
    `*Ask me*\n` +
    `*balance* — deposits, profit share, current value\n` +
    `*loan* — active loan & interest due\n` +
    `*history* — past loan cycles\n` +
    `*txns* — latest transactions\n` +
    `*txns july* — one month's transactions\n` +
    `*txns on 2026-07-01* — one day's\n` +
    `*due* — everything you owe\n\n` +
    `*Record an entry*\n` +
    `*<member or vendor> <type> <amount> to <treasurer>*\n\n` +
    `Types of transaction:\n` +
    `• *paid* — monthly deposit handed to a treasurer\n` +
    `• *repaid* — loan principal paid back\n` +
    `• *interest* — loan interest collected\n` +
    `• *loan* — loan given to a member\n` +
    `• *invest* — club money invested with a vendor\n` +
    `• *return* — money a vendor returned (add *principal <amt>* for the capital part)\n\n` +
    `Optional add-ons: *on 2026-07-01* (date, default today), *note <anything>*\n` +
    `Examples:\n` +
    `*ravi paid 2000 to suresh note july deposit*\n` +
    `*ravi loan 50000 from suresh*\n` +
    `*hdfc chit invest 25000 from suresh*\n` +
    `*hdfc chit return 30000 to suresh principal 25000*`;
  if (!sender.isAdmin) return intro + `\n\nYour entries go to an admin for approval before they're recorded.`;
  return (
    intro +
    `\n\n*Admin*\nAdd a name to any query: *balance ravi*, *txns ravi july*.\n` +
    `Your entries post after you tap *Confirm* on the preview; members' entries wait in your approval inbox.`
  );
}
