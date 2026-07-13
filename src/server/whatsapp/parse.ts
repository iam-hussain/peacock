/**
 * Pure text → entry-command parser (no imports, so scripts/check-whatsapp-parse.mts
 * can exercise it without a DB). Grammar — treasurer is REQUIRED, date and note optional:
 *   "<member> paid|repaid|interest <amount> to <treasurer> [on yyyy-mm-dd] [note <text>]"
 */
const ENTRY_RE =
  /^(.{2,40}?)\s+(paid|repaid|interest)\s+(₹?[\d.,]+(?:l|cr|k)?)\s+to\s+(.{2,40}?)(?:\s+on\s+(\d{4}-\d{2}-\d{2}))?(?:\s+note\s+(.+))?$/i;

export const VERB_TO_INTENT: Record<string, string> = {
  paid: "Member paid deposit",
  repaid: "Record repayment",
  interest: "Collect interest",
};

export interface ParsedEntry {
  who: string;
  intent: string;
  amountRaw: string;
  treasurer: string;
  date?: string;
  note?: string;
}

/** Loose check: "<name> paid/repaid/interest…" — anything entry-shaped, even incomplete, so the
 *  bot can answer with exactly what's missing instead of falling through to generic help. */
export const looksLikeEntryStart = (text: string) => /^.{2,40}?\s+(paid|repaid|interest)(\s|$)/i.test(text.trim());

/** For an entry-shaped text that failed the full grammar: name the FIRST missing piece. */
export function entryMissing(text: string): string {
  const t = text.trim();
  if (!/\s(paid|repaid|interest)\s+₹?[\d.,]/i.test(t)) return "the *amount* (e.g. 2000)";
  if (!/\s+to\s+.{2,}/i.test(t)) return "the *treasurer* who received the cash (*to <name>*)";
  return "a valid *date* (*on 2026-07-01*)"; // amount + treasurer present → the date part must be malformed
}

export function parseEntryText(text: string): ParsedEntry | null {
  const m = ENTRY_RE.exec(text.trim());
  if (!m) return null;
  const [, who, verb, amountRaw, treasurer, date, note] = m;
  return { who: who.trim(), intent: VERB_TO_INTENT[verb.toLowerCase()], amountRaw, treasurer: treasurer.trim(), date, note: note?.trim() };
}
