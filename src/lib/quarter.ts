/** Quarter boundaries for the FY-quarter containing `now` (fyStartMonth is 1-12, e.g. 4 = Apr). */
export function quarterBounds(now: Date, fyStartMonth: number): { start: Date; end: Date; label: string } {
  let fyStart = new Date(Date.UTC(now.getUTCFullYear(), fyStartMonth - 1, 1));
  if (now < fyStart) fyStart = new Date(Date.UTC(now.getUTCFullYear() - 1, fyStartMonth - 1, 1));
  const monthsIn = (now.getUTCFullYear() - fyStart.getUTCFullYear()) * 12 + (now.getUTCMonth() - fyStart.getUTCMonth());
  const qIndex = Math.floor(monthsIn / 3);
  const start = new Date(Date.UTC(fyStart.getUTCFullYear(), fyStart.getUTCMonth() + qIndex * 3, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0, 23, 59, 59));
  return { start, end, label: `Q${qIndex + 1} ${start.getUTCFullYear()}` };
}
