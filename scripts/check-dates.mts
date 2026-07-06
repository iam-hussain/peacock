// Self-check for the IST calendar-date math in src/lib/date.ts — run: npx tsx scripts/check-dates.mts
// Transactions are date-based; stored times-of-day vary (midnight UTC, midnight IST, real entry
// times), so daysBetween/monthsDays must depend only on the IST calendar date of each instant.
import assert from "node:assert";
import { istDate, daysBetween, monthsDays, addMonths } from "../src/lib/date";

// 13 Feb 16:42 IST → 14 Feb 00:00 IST is 1 day, even though only ~13h elapsed
assert.equal(daysBetween(new Date("2025-02-13T11:12:23Z"), new Date("2025-02-14T00:00:00Z")), 1);
assert.equal(monthsDays(new Date("2025-02-13T11:12:23Z"), new Date("2025-02-14T00:00:00Z")), "1 day");

// same IST date, different times → 0 days
assert.equal(daysBetween(new Date("2025-02-13T05:00:00Z"), new Date("2025-02-13T14:00:00Z")), 0);

// calendar months + leftover days, storage convention irrelevant (both mean IST 12 Mar → 10 Jul)
assert.equal(monthsDays(new Date("2025-03-11T18:30:00Z"), new Date("2025-07-10T00:00:00Z")), "3 months 28 days");
assert.equal(monthsDays(new Date("2025-03-12T00:00:00Z"), new Date("2025-07-09T18:30:00Z")), "3 months 28 days");
assert.equal(monthsDays(new Date("2025-03-12"), new Date("2025-07-12")), "4 months");

// month-end clamping: 31 Jan + 1 month → 28 Feb, and stepping stays anchored to the original day
assert.equal(monthsDays(new Date("2025-01-31"), new Date("2025-02-28")), "1 month");
assert.equal(addMonths(new Date("2025-01-31"), 2).toISOString().slice(0, 10), "2025-03-31");

// istDate is idempotent and always UTC-midnight of the IST calendar date
const d = new Date("2025-02-13T11:12:23.011Z");
assert.equal(istDate(d).toISOString(), "2025-02-13T00:00:00.000Z");
assert.equal(istDate(istDate(d)).getTime(), istDate(d).getTime());
assert.equal(istDate(new Date("2025-02-13T18:30:00Z")).toISOString(), "2025-02-14T00:00:00.000Z");

console.log("check-dates: all assertions passed");
