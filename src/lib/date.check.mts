/**
 * Runnable checks for the date/quarter math changed in the perf/correctness pass.
 * Run: node --import tsx src/lib/date.check.mts
 * These pin the invariants accruedInterest() relies on (it's server-only, so can't import here):
 * month-end clamp + anchoring, same-day → 0 days, and IST quarter boundaries.
 */
import { addMonths, daysBetween } from "./date";
import { quarterBounds } from "./quarter";

let n = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  n++;
  if (String(got) !== String(want)) throw new Error(`FAIL: ${msg}\n  got ${got}\n  want ${want}`);
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

// --- addMonths: month-end clamp, anchored to original day (no Feb-31→Mar-3 overflow, no drift) ---
eq(iso(addMonths(new Date("2025-01-31T00:00:00Z"), 1)), "2025-02-28", "Jan 31 +1mo clamps to Feb 28");
eq(iso(addMonths(new Date("2024-01-31T00:00:00Z"), 1)), "2024-02-29", "Jan 31 +1mo clamps to Feb 29 in leap year");
eq(iso(addMonths(new Date("2025-01-31T00:00:00Z"), 2)), "2025-03-31", "Jan 31 +2mo anchors back to Mar 31 (no drift)");
eq(iso(addMonths(new Date("2025-01-31T00:00:00Z"), 3)), "2025-04-30", "Jan 31 +3mo clamps to Apr 30");
eq(iso(addMonths(new Date("2025-01-15T00:00:00Z"), 1)), "2025-02-15", "mid-month unchanged");
eq(iso(addMonths(new Date("2025-12-31T00:00:00Z"), 1)), "2026-01-31", "crosses year end");

// --- daysBetween: same day / <24h → 0 (this is what makes same-day loan+close accrue 0 interest) ---
eq(daysBetween(new Date("2025-08-01T10:00:00Z"), new Date("2025-08-01T17:00:00Z")), 0, "same day → 0 days");
eq(daysBetween(new Date("2025-08-01T10:00:00Z"), new Date("2025-08-02T09:00:00Z")), 0, "23h → 0 days");
eq(daysBetween(new Date("2025-08-01T10:00:00Z"), new Date("2025-08-27T10:00:00Z")), 26, "26 full days");

// --- quarterBounds: IST wall-clock. FY starts Apr (fyStartMonth=4). ---
// 2025-06-30T20:00Z = 2025-07-01 01:30 IST → Q2 (Jul–Sep), not Q1.
{
  const q = quarterBounds(new Date("2025-06-30T20:00:00Z"), 4);
  eq(q.label, "Q2 2025", "IST boundary rolls into Q2");
  eq(iso(q.start), "2025-06-30", "Q2 start = IST Jul 1 midnight (UTC 2025-06-30T18:30Z)");
}
// Mid-quarter sanity: 2025-05-15 IST is Q1 (Apr–Jun) of FY2025.
eq(quarterBounds(new Date("2025-05-15T06:00:00Z"), 4).label, "Q1 2025", "mid-Q1");

console.log(`ok — ${n} date/quarter assertions passed`);
