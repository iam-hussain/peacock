const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Jan 2020" */
export function monthYear(d: Date): string {
  return `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "28 Jun 2025" */
export function dayMonthYear(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "28 Jun" */
export function dayMonth(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MON[d.getUTCMonth()]}`;
}

/** whole days between two dates (b − a), floored at 0 */
export function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86_400_000));
}

/** "5 yrs 6 mos" style tenure from a start date to now */
export function tenure(from: Date, to = new Date()): string {
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (months < 0) months = 0;
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (y) parts.push(`${y} yr${y > 1 ? "s" : ""}`);
  parts.push(`${m} mo${m === 1 ? "" : "s"}`);
  return parts.join(" ");
}
