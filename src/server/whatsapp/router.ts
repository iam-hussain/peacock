import "server-only";
import { getMemberDetail, getMemberRoster, type MemberDetailDTO, type RosterEntryDTO } from "@/server/queries/members";
import { getTransactionsPage } from "@/server/queries/transactions";
import { matchMember, senderByWaId, type WaSender } from "./identity";
import { sendText } from "./send";
import { looksLikeEntry, startEntry, decideEntry, listPending } from "./entry";

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

  // An inactive member (left the club, hasn't rejoined) only sees what it takes to rejoin — no
  // balances, loans, or entries. Admins are exempt so they never lock themselves out.
  if (!sender.isActive && !sender.isAdmin) {
    const d = await getMemberDetail(sender.id);
    return sendText(waId, d ? inactiveText(d) : "Your account is inactive. Contact an admin to rejoin.");
  }

  if (looksLikeEntry(text)) return startEntry(sender, waId, text);

  const [cmd, ...rest] = text.toLowerCase().split(/\s+/);
  const arg = rest.join(" ");

  // Admins can point a query at another member by name; everyone else always sees themself.
  const resolveTarget = async (nameArg: string): Promise<WaSender | string> => {
    if (!nameArg || !sender.isAdmin) return sender;
    const t = await matchMember(nameArg);
    if (t.ambiguous) return `Which one? ${t.ambiguous.join(", ")}`;
    return t.member ?? `No member matches "${nameArg}". Send *members* to see who's registered.`;
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
      const size = period.start ? 20 : 5;
      // "txns treasurer <name>" / "txns by <name>" scopes to cash a treasurer handled; otherwise
      // the leading text is a member/vendor name (a person's transactions).
      const trez = /^(?:treasurer|held by|by)\b\s*(.*)$/i.exec(period.rest);
      let filter: Parameters<typeof getTransactionsPage>[0];
      let titleScope = "", emptyScope = "";
      if (trez) {
        const target = await resolveTarget(trez[1].trim());
        if (typeof target === "string") return sendText(waId, target);
        filter = { treasurer: target.name, start: period.start, end: period.end, page: 1, size };
        titleScope = ` — handled by ${target.name}`;
        emptyScope = ` handled by ${target.name}`;
      } else {
        const target = await resolveTarget(period.rest);
        if (typeof target === "string") return sendText(waId, target);
        // Admin's bare "txns" = the club's latest ledger rows; otherwise the target member's.
        const party = sender.isAdmin && !period.rest ? undefined : target.name;
        filter = { party, start: period.start, end: period.end, page: 1, size };
        titleScope = party ? ` — ${party}` : "";
        emptyScope = party ? ` for ${party}` : "";
      }
      const page = await getTransactionsPage(filter);
      if (!page.rows.length) return sendText(waId, `No transactions${emptyScope}${period.label ? ` ${period.label}` : ""}.`);
      const lines = page.rows.map(
        (t) => `${t.date} · ${t.what}\n${t.from.name} → ${t.to.name} · ${t.amount}` + (t.note ? `\n📝 ${t.note}` : ""),
      );
      const more = page.total > page.rows.length ? `\n\nShowing ${page.rows.length} of ${page.total} — open the app for the rest.` : "";
      return sendText(waId, `*Transactions*${titleScope}${period.label ? ` ${period.label}` : " (latest)"}\n\n${lines.join("\n\n")}${more}`);
    }
    case "members":
    case "list": {
      const roster = await getMemberRoster();
      return sendText(waId, rosterText(roster));
    }
    case "pending":
    case "approvals":
    case "inbox":
      return listPending(sender, waId);
    case "catchup":
    case "catch-up":
    case "penalty":
    case "penalties": {
      const target = await resolveTarget(arg);
      if (typeof target === "string") return sendText(waId, target);
      const d = await getMemberDetail(target.id);
      if (!d) return sendText(waId, "No record found.");
      return sendText(waId, chargesText(d, cmd.startsWith("pen") ? "penalty" : "catchup"));
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
  // Break out each kind still owed (shown only when outstanding); "Total due" is the all-in figure
  // (deposit pending + catch-up + penalty + loan interest).
  const catchup = d.ledgerRemainingRupees > 0 ? `\nCatch-up due: ${d.ledgerRemaining}` : "";
  const penalty = d.penaltyRemainingRupees > 0 ? `\nPenalty due: ${d.penaltyRemaining}` : "";
  const interest = d.interestDue !== "₹0" ? `\nInterest due: ${d.interestDue}` : "";
  return (
    `*${d.name}* — ${d.status}\n\n` +
    `Deposits paid: ${d.depositsTotal}\n` +
    `Profit share: ${d.profit}\n` +
    `Current value: ${d.value}` +
    catchup +
    penalty +
    interest +
    `\nTotal due: ${orNone(d.totalDue)}` +
    (d.held ? `\n\nClub cash held (treasury): ${d.held}` : "")
  );
}

function loanText(d: MemberDetailDTO): string {
  if (!d.hasLoans) return `*${d.name}*\n\nNo loans yet.`;
  // Current-loan dates only when one is active (§8): start + fixed term-end (flagged if overdue).
  const dates = d.loanStarted
    ? `\nStarted: ${d.loanStarted}\n${d.loanOverdue ? "Due (overdue)" : "Due"}: ${d.loanDue}`
    : "";
  return (
    `*${d.name} — loan*\n\n` +
    `Outstanding: ${d.currentLoan}\n` +
    `Interest due: ${d.interestDue}` +
    dates
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

/** Itemised catch-up or penalty ledger: charged / paid / remaining, then each charge (+) and
 *  payment (−) newest-first (capped, with an overflow note pointing to the app). */
function chargesText(d: MemberDetailDTO, kind: "penalty" | "catchup"): string {
  const label = kind === "penalty" ? "penalty" : "catch-up";
  const entries = kind === "penalty" ? d.penaltyEntries : d.catchupEntries;
  const assigned = kind === "penalty" ? d.penaltyAssigned : d.ledgerAssigned;
  const paid = kind === "penalty" ? d.penaltyPaid : d.ledgerPaid;
  const remaining = kind === "penalty" ? d.penaltyRemaining : d.ledgerRemaining;
  if (!entries.length) return `*${d.name} — ${label}*\n\nNo ${label} entries.`;
  const shown = entries.slice(0, 10);
  const rows = shown.map((e) => `${e.date} · ${e.title}\n${e.by} · ${e.amount}` + (e.note ? `\n📝 ${e.note}` : ""));
  const more = entries.length > shown.length ? `\n\nShowing ${shown.length} of ${entries.length} — open the app for the rest.` : "";
  return (
    `*${d.name} — ${label}*\n\n` +
    `Charged: ${assigned}\nPaid: ${paid}\nRemaining: ${remaining}\n\n` +
    rows.join("\n\n") +
    more
  );
}

/** Inactive members (left, not yet rejoined) get only the rejoin quote — back deposits + catch-up. */
function inactiveText(d: MemberDetailDTO): string {
  if (!d.rejoin) return `*${d.name}* — inactive\n\nYour account is inactive. Contact an admin to rejoin.`;
  return (
    `*${d.name}* — inactive\n\n` +
    `Your account is inactive. To rejoin, you'd deposit:\n` +
    `Back deposits: ${d.rejoin.depDue}\n` +
    `Catch-up: ${d.rejoin.profit}\n` +
    `Total: ${d.rejoin.total}`
  );
}

/** Roster of who's registered — active first, then inactive — names only (for `members`). */
function rosterText(roster: RosterEntryDTO[]): string {
  const names = (s: RosterEntryDTO["status"]) => roster.filter((r) => r.status === s).map((r) => `• ${r.name}`);
  const active = names("active"), inactive = names("inactive");
  if (!active.length && !inactive.length) return `*Members*\n\nNo members yet.`;
  const parts = [`*Members*`];
  if (active.length) parts.push(`*Active* (${active.length})\n${active.join("\n")}`);
  if (inactive.length) parts.push(`*Inactive* (${inactive.length})\n${inactive.join("\n")}`);
  return parts.join("\n\n");
}

function helpText(sender: WaSender): string {
  const intro =
    `Hi ${sender.name.split(" ")[0]}! I'm the *Peacock Investment Club* bot 🦚\n\n` +
    `*Ask me*\n` +
    `*balance* — deposits, profit share, current value\n` +
    `*loan* — active loan & interest due\n` +
    `*history* — past loan cycles\n` +
    `*catchup* — catch-up charges & payments\n` +
    `*penalties* — penalty charges & payments\n` +
    `*members* — who's registered (active & inactive)\n` +
    `*txns* — latest transactions\n` +
    `*txns july* / *txns july 2026* — one month (year optional, default this year)\n` +
    `*txns on 2026-07-01* — one day's\n` +
    `*txns treasurer <name>* — cash a treasurer handled\n` +
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
    `*pending* — review members' entries waiting for approval, with Approve/Reject buttons.\n` +
    `Your entries post after you tap *Confirm* on the preview; members' entries wait for your *pending* review.`
  );
}
