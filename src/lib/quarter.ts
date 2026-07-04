import { ist } from "./date";

// The club runs on IST (fixed UTC+5:30). Quarter boundaries are read on the IST wall-clock and
// returned as the UTC instants that correspond to IST midnight / 23:59:59, consistent with the
// rest of the app (which buckets via ist()). Computing in raw UTC misfiled a quarter for any
// `now` near an IST month boundary (e.g. 2025-03-31T20:00Z = Apr 1 IST).
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Quarter boundaries (IST) for the FY-quarter containing `now`. fyStartMonth is 1-12, e.g. 4 = Apr. */
export function quarterBounds(now: Date, fyStartMonth: number): { start: Date; end: Date; label: string } {
  const i = ist(now); // IST wall-clock, read via UTC parts of the shifted value
  const y = i.getUTCFullYear();
  const m = i.getUTCMonth(); // 0-11, IST
  // If the current IST month is before the FY start month, the fiscal year began last calendar year.
  const fyStartYear = m >= fyStartMonth - 1 ? y : y - 1;
  const monthsIn = (y - fyStartYear) * 12 + (m - (fyStartMonth - 1));
  const qIndex = Math.floor(monthsIn / 3);
  const qStartAbs = fyStartMonth - 1 + qIndex * 3; // absolute month index from fyStartYear (may exceed 11)
  const sy = fyStartYear + Math.floor(qStartAbs / 12);
  const sm = qStartAbs % 12;
  // UTC instants for IST midnight (start) and IST 23:59:59 of the quarter's last day (end).
  const start = new Date(Date.UTC(sy, sm, 1) - IST_OFFSET_MS);
  const end = new Date(Date.UTC(sy, sm + 3, 0, 23, 59, 59) - IST_OFFSET_MS);
  return { start, end, label: `Q${qIndex + 1} ${sy}` };
}
