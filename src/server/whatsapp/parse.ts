/**
 * Pure text → entry-command parser (no imports, so scripts/check-whatsapp-parse.mts
 * can exercise it without a DB). Grammar:
 *   "<name> paid|repaid|interest <amount> [to <treasurer>] [on yyyy-mm-dd]"
 */

// "<name> paid|repaid|interest <amount> [to <treasurer>] [on yyyy-mm-dd]"
const ENTRY_RE = /^(.{2,40}?)\s+(paid|repaid|interest)\s+(₹?[\d.,]+(?:l|cr|k)?)(?:\s+to\s+(.{2,40}?))?(?:\s+on\s+(\d{4}-\d{2}-\d{2}))?$/i;

export const VERB_TO_INTENT: Record<string, string> = {
  paid: "Member paid deposit",
  repaid: "Record repayment",
  interest: "Collect interest",
};

export interface ParsedEntry {
  who: string;
  intent: string;
  amountRaw: string;
  treasurer?: string;
  date?: string;
}

export function parseEntryText(text: string): ParsedEntry | null {
  const m = ENTRY_RE.exec(text.trim());
  if (!m) return null;
  const [, who, verb, amountRaw, treasurer, date] = m;
  return { who: who.trim(), intent: VERB_TO_INTENT[verb.toLowerCase()], amountRaw, treasurer: treasurer?.trim(), date };
}
