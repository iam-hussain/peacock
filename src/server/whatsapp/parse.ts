/**
 * Pure text → entry-command parser (no imports, so scripts/check-whatsapp-parse.mts
 * can exercise it without a DB). Grammar — party/type/amount/treasurer REQUIRED, the rest optional:
 *   "<member|vendor> <verb> <amount> to|from|for <treasurer> [principal <amt>] [on <date>] [note <text>]"
 * `to`/`from`/`for` are interchangeable — direction comes from the verb, not the preposition, so a
 * natural "cibi loan 100000 for swathis" reads the same as "…to swathis".
 * Amounts accept plain digits or shorthand: `100000`, `₹1,00,000`, `1L`, `5.5l`, `2cr`, `50k`.
 * Dates accept any common separator and either order: `2026-12-01`, `2026/12/01`, `01-12-2026`,
 * `1.12.2026` (normalised to yyyy-mm-dd before it leaves the parser).
 */

// Shared sub-patterns (kept as strings so the grammar reads in one place).
const AMOUNT = String.raw`₹?[\d.,]+(?:l|cr|k)?`;
// A numeric date token with -, / or . separators, either yyyy-first or day-first — a single
// non-space run so the trailing "note …" stays unambiguous. Textual months are handled by
// normalizeDate for looser query contexts, not the inline entry grammar.
const DATE = String.raw`\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}`;
const PREP = String.raw`(?:to|from|for)`;

const ENTRY_RE = new RegExp(
  String.raw`^(.{2,40}?)\s+(paid|repaid|interest|loan|invest|return|catchup|catch-up|penalty)\s+(${AMOUNT})\s+${PREP}\s+(.{2,40}?)(?:\s+principal\s+(${AMOUNT}))?(?:\s+on\s+(${DATE}))?(?:\s+note\s+(.+))?$`,
  "i",
);

export const VERB_TO_INTENT: Record<string, string> = {
  paid: "Member paid deposit",
  repaid: "Record repayment",
  interest: "Collect interest",
  loan: "Give a loan",
  invest: "Vendor investment",
  return: "Vendor return",
  catchup: "Catch-up payment",
  "catch-up": "Catch-up payment",
  penalty: "Delayed-payment penalty",
};

/** Intents whose party is a VENDOR (resolved against the Vendor table, not members). */
export const VENDOR_ENTRY_INTENTS = new Set(["Vendor investment", "Vendor return"]);
/** Intents where cash LEAVES the treasurer (preview shows "Cash from" instead of "Cash to"). */
export const OUTFLOW_INTENTS = new Set(["Give a loan", "Vendor investment"]);

export interface ParsedEntry {
  who: string;
  intent: string;
  amountRaw: string;
  treasurer: string;
  principal?: string;
  date?: string; // always normalised to yyyy-mm-dd when present
  note?: string;
}

const VERBS = "(paid|repaid|interest|loan|invest|return|catchup|catch-up|penalty)";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const pad = (n: number) => String(n).padStart(2, "0");
const valid = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2999;

/**
 * Normalise a user-typed date to `yyyy-mm-dd`, or null if it isn't a date. Accepts:
 *   • numeric with - / . separators, yyyy-first (2026-12-01) or day-first (01/12/2026, 1.12.26);
 *   • textual months (15 July, 15th Jul 2026, July 15, Jul 15 2026) — year defaults to the current
 *     year when omitted. Day-first is assumed for all-numeric ambiguous inputs (Indian convention).
 */
export function normalizeDate(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  // Numeric: yyyy[sep]mm[sep]dd
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  // Numeric: dd[sep]mm[sep]yyyy  (or 2-digit year → 20yy)
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  // Textual: "15 July [2026]" / "15th Jul" — day, month name, optional year.
  m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,})\.?(?:\s+(\d{4}))?$/.exec(s);
  if (m) return fromWords(Number(m[1]), m[2], m[3]);
  // Textual: "July 15 [2026]" / "Jul 15th" — month name, day, optional year.
  m = /^([a-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$/.exec(s);
  if (m) return fromWords(Number(m[2]), m[1], m[3]);
  return null;
}

function fromWords(d: number, monthWord: string, yearWord?: string): string | null {
  const mi = MONTHS.findIndex((full) => full.startsWith(monthWord));
  if (mi < 0) return null;
  const y = yearWord ? Number(yearWord) : new Date().getFullYear();
  return valid(y, mi + 1, d) ? `${y}-${pad(mi + 1)}-${pad(d)}` : null;
}

/** Loose check: "<name> <verb>…" — anything entry-shaped, even incomplete, so the
 *  bot can answer with exactly what's missing instead of falling through to generic help. */
export const looksLikeEntryStart = (text: string) => new RegExp(`^.{2,40}?\\s+${VERBS}(\\s|$)`, "i").test(text.trim());

/** For an entry-shaped text that failed the full grammar: name the FIRST missing piece. */
export function entryMissing(text: string): string {
  const t = text.trim();
  if (!new RegExp(`\\s${VERBS}\\s+₹?[\\d.,]`, "i").test(t)) return "the *amount* (e.g. 2000)";
  if (!/\s+(to|from|for)\s+.{2,}/i.test(t)) return "the *treasurer* who handled the cash (*to <name>*)";
  return "a valid *date* (*on 2026-12-01* or *01/12/2026*)"; // amount + treasurer present → the date part must be malformed
}

export function parseEntryText(text: string): ParsedEntry | null {
  const m = ENTRY_RE.exec(text.trim());
  if (!m) return null;
  const [, who, verb, amountRaw, treasurer, principal, date, note] = m;
  // A date token matched the numeric shape but could still be out of range (month 13) — reject the
  // whole parse so the bot flags the date instead of silently posting today.
  const normDate = date ? normalizeDate(date) : undefined;
  if (date && !normDate) return null;
  return { who: who.trim(), intent: VERB_TO_INTENT[verb.toLowerCase()], amountRaw, treasurer: treasurer.trim(), principal, date: normDate ?? undefined, note: note?.trim() };
}

// Raising a charge (admin) has no treasurer — it's the obligation itself, not a cash movement:
//   "charge <member> <catchup|penalty> <amount> [on <date>] [note <text>]"
const CHARGE_RE = new RegExp(
  String.raw`^charge\s+(.{2,40}?)\s+(catchup|catch-up|penalty)\s+(${AMOUNT})(?:\s+on\s+(${DATE}))?(?:\s+note\s+(.+))?$`,
  "i",
);

export interface ParsedCharge {
  who: string;
  kind: "CATCHUP" | "PENALTY";
  amountRaw: string;
  date?: string; // normalised to yyyy-mm-dd when present
  note?: string;
}

/** Text starting with "charge " routes to the charge handler (before the entry grammar). */
export const looksLikeCharge = (text: string) => /^charge(\s|$)/i.test(text.trim());

export function parseChargeText(text: string): ParsedCharge | null {
  const m = CHARGE_RE.exec(text.trim());
  if (!m) return null;
  const [, who, kindRaw, amountRaw, date, note] = m;
  const normDate = date ? normalizeDate(date) : undefined;
  if (date && !normDate) return null;
  return { who: who.trim(), kind: kindRaw.toLowerCase().startsWith("pen") ? "PENALTY" : "CATCHUP", amountRaw, date: normDate ?? undefined, note: note?.trim() };
}
