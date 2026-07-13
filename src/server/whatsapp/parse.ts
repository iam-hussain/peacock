/**
 * Pure text → entry-command parser (no imports, so scripts/check-whatsapp-parse.mts
 * can exercise it without a DB). Grammar — party/type/amount/treasurer REQUIRED, the rest optional:
 *   "<member|vendor> <verb> <amount> to|from <treasurer> [principal <amt>] [on yyyy-mm-dd] [note <text>]"
 * `to`/`from` are interchangeable — direction comes from the verb, not the preposition.
 */
const ENTRY_RE =
  /^(.{2,40}?)\s+(paid|repaid|interest|loan|invest|return)\s+(₹?[\d.,]+(?:l|cr|k)?)\s+(?:to|from)\s+(.{2,40}?)(?:\s+principal\s+(₹?[\d.,]+(?:l|cr|k)?))?(?:\s+on\s+(\d{4}-\d{2}-\d{2}))?(?:\s+note\s+(.+))?$/i;

export const VERB_TO_INTENT: Record<string, string> = {
  paid: "Member paid deposit",
  repaid: "Record repayment",
  interest: "Collect interest",
  loan: "Give a loan",
  invest: "Vendor investment",
  return: "Vendor return",
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
  date?: string;
  note?: string;
}

const VERBS = "(paid|repaid|interest|loan|invest|return)";

/** Loose check: "<name> <verb>…" — anything entry-shaped, even incomplete, so the
 *  bot can answer with exactly what's missing instead of falling through to generic help. */
export const looksLikeEntryStart = (text: string) => new RegExp(`^.{2,40}?\\s+${VERBS}(\\s|$)`, "i").test(text.trim());

/** For an entry-shaped text that failed the full grammar: name the FIRST missing piece. */
export function entryMissing(text: string): string {
  const t = text.trim();
  if (!new RegExp(`\\s${VERBS}\\s+₹?[\\d.,]`, "i").test(t)) return "the *amount* (e.g. 2000)";
  if (!/\s+(to|from)\s+.{2,}/i.test(t)) return "the *treasurer* who handled the cash (*to <name>*)";
  return "a valid *date* (*on 2026-07-01*)"; // amount + treasurer present → the date part must be malformed
}

export function parseEntryText(text: string): ParsedEntry | null {
  const m = ENTRY_RE.exec(text.trim());
  if (!m) return null;
  const [, who, verb, amountRaw, treasurer, principal, date, note] = m;
  return { who: who.trim(), intent: VERB_TO_INTENT[verb.toLowerCase()], amountRaw, treasurer: treasurer.trim(), principal, date, note: note?.trim() };
}
