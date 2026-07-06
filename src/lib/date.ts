const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The club runs on IST (fixed UTC+5:30, no DST). DB stores UTC instants; all display & calendar
// bucketing reads the IST wall-clock by shifting +5:30 and reading UTC parts of the shifted value.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const ist = (d: Date): Date => new Date(d.getTime() + IST_OFFSET_MS);

/** "2025-06-28" (IST) — default for <input type="date"> so it doesn't slip a day near midnight */
export function isoDate(d: Date = new Date()): string {
  return ist(d).toISOString().slice(0, 10);
}

/** "Jan 2020" (IST) */
export function monthYear(d: Date): string {
  const i = ist(d);
  return `${MON[i.getUTCMonth()]} ${i.getUTCFullYear()}`;
}

/** "28 Jun 2025" (IST) */
export function dayMonthYear(d: Date): string {
  const i = ist(d);
  return `${String(i.getUTCDate()).padStart(2, "0")} ${MON[i.getUTCMonth()]} ${i.getUTCFullYear()}`;
}

/** "28 Jun" (IST) */
export function dayMonth(d: Date): string {
  const i = ist(d);
  return `${String(i.getUTCDate()).padStart(2, "0")} ${MON[i.getUTCMonth()]}`;
}

/** The IST calendar date of an instant, as a UTC-midnight Date. Transactions are date-based —
 * stored times-of-day vary (midnight UTC, midnight IST, real entry times), so ALL date math must
 * go through this to compare calendar dates, never raw instants. Idempotent. */
export function istDate(d: Date): Date {
  const i = ist(d);
  i.setUTCHours(0, 0, 0, 0);
  return i;
}

/** whole IST calendar days between two dates (b − a), floored at 0 — 13 Feb → 14 Feb is 1 day
 * regardless of the stored times-of-day */
export function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((istDate(b).getTime() - istDate(a).getTime()) / 86_400_000));
}

/** Date shifted by n whole calendar months (used for loan term-end / cooldown windows).
 * Clamps to month-end so a month-end start doesn't overflow: Jan 31 + 1 → Feb 28, not Mar 3.
 * Anchor from the original day each call (don't step a clamped value) to avoid drift. */
export function addMonths(d: Date, n: number): Date {
  const day = d.getUTCDate();
  const r = new Date(d);
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + n);
  const lastDay = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, lastDay));
  return r;
}

/** "3 months 28 days" — whole calendar months from `from`, plus leftover days (IST dates). */
export function monthsDays(fromRaw: Date, toRaw: Date, short = false): string {
  const from = istDate(fromRaw), to = istDate(toRaw);
  let m = Math.max(0, (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth());
  while (m > 0 && addMonths(from, m) > to) m--;
  const d = daysBetween(addMonths(from, m), to);
  const parts: string[] = [];
  if (m) parts.push(short ? `${m}mo` : `${m} month${m === 1 ? "" : "s"}`);
  if (d || !m) parts.push(short ? `${d}d` : `${d} day${d === 1 ? "" : "s"}`);
  return parts.join(" ");
}

/** "5 yrs 6 mos" style tenure from a start date to now */
export function tenure(from: Date, to = new Date()): string {
  const f = ist(from), t = ist(to);
  let months = (t.getUTCFullYear() - f.getUTCFullYear()) * 12 + (t.getUTCMonth() - f.getUTCMonth());
  if (months < 0) months = 0;
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (y) parts.push(`${y} yr${y > 1 ? "s" : ""}`);
  parts.push(`${m} mo${m === 1 ? "" : "s"}`);
  return parts.join(" ");
}
