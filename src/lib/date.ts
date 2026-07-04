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

/** whole days between two dates (b − a), floored at 0 */
export function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86_400_000));
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

/** "4 months 5 days" from a whole-day count (30-day months for display). */
export function monthsDays(days: number): string {
  const m = Math.floor(days / 30);
  const d = days % 30;
  const parts: string[] = [];
  if (m) parts.push(`${m} month${m === 1 ? "" : "s"}`);
  if (d || !m) parts.push(`${d} day${d === 1 ? "" : "s"}`);
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
