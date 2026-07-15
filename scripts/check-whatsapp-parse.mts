// Self-check for the WhatsApp entry grammar: `npx tsx scripts/check-whatsapp-parse.mts`
import assert from "node:assert";
import { parseEntryText, parseChargeText, looksLikeEntryStart, looksLikeCharge, entryMissing, normalizeDate } from "../src/server/whatsapp/parse";

// Valid shapes — treasurer is required; date and note optional
assert.deepEqual(parseEntryText("ravi paid 2000 to suresh"), {
  who: "ravi", intent: "Member paid deposit", amountRaw: "2000", treasurer: "suresh", principal: undefined, date: undefined, note: undefined,
});
assert.deepEqual(parseEntryText("Ravi Kumar repaid ₹5,000 to Suresh on 2026-07-01"), {
  who: "Ravi Kumar", intent: "Record repayment", amountRaw: "₹5,000", treasurer: "Suresh", principal: undefined, date: "2026-07-01", note: undefined,
});
assert.deepEqual(parseEntryText("ravi interest 500 to suresh note june interest"), {
  who: "ravi", intent: "Collect interest", amountRaw: "500", treasurer: "suresh", principal: undefined, date: undefined, note: "june interest",
});
assert.equal(parseEntryText("  ravi PAID 5.5L to suresh on 2026-06-15 note big month  ")?.note, "big month");

// New verbs: loan given, vendor invest, vendor return (with principal split)
assert.equal(parseEntryText("ravi loan 50000 from suresh")?.intent, "Give a loan");
assert.equal(parseEntryText("hdfc chit invest 25000 from suresh")?.intent, "Vendor investment");
const ret = parseEntryText("hdfc chit return 30000 to suresh principal 25000 on 2026-07-01");
assert.deepEqual(ret, {
  who: "hdfc chit", intent: "Vendor return", amountRaw: "30000", treasurer: "suresh", principal: "25000", date: "2026-07-01", note: undefined,
});

// Incomplete entries must NOT parse, and the missing-piece hint must name the right gap
assert.equal(parseEntryText("ravi paid 2000"), null);
assert.match(entryMissing("ravi paid 2000"), /treasurer/);
assert.equal(parseEntryText("ravi paid"), null);
assert.match(entryMissing("ravi paid"), /amount/);
assert.ok(looksLikeEntryStart("ravi paid"), "incomplete entries still route to the entry hint");

// Catch-up / penalty PAYMENTS ride the same entry grammar (member pays a treasurer)
assert.equal(parseEntryText("ravi catchup 2000 to suresh")?.intent, "Catch-up payment");
assert.equal(parseEntryText("ravi catch-up 2000 to suresh")?.intent, "Catch-up payment");
assert.equal(parseEntryText("ravi penalty 500 to suresh")?.intent, "Delayed-payment penalty");

// Raising a CHARGE (admin) — no treasurer; parsed by parseChargeText, routed by looksLikeCharge
assert.deepEqual(parseChargeText("charge ravi penalty 500 note late June"), {
  who: "ravi", kind: "PENALTY", amountRaw: "500", date: undefined, note: "late June",
});
assert.deepEqual(parseChargeText("charge Ravi Kumar catchup 1000 on 2026-07-01"), {
  who: "Ravi Kumar", kind: "CATCHUP", amountRaw: "1000", date: "2026-07-01", note: undefined,
});
assert.ok(looksLikeCharge("charge ravi penalty 500"), "charge command routes to the charge handler");
assert.equal(parseChargeText("ravi paid 2000 to suresh"), null, "an entry is not a charge");
assert.equal(looksLikeCharge("charge ravi penalty 500"), true);

// "for" and "from" are interchangeable with "to" — direction comes from the verb, not the preposition.
assert.deepEqual(parseEntryText("cibi loan 100000 to swathis on 2026-12-01"), {
  who: "cibi", intent: "Give a loan", amountRaw: "100000", treasurer: "swathis", principal: undefined, date: "2026-12-01", note: undefined,
});
assert.deepEqual(parseEntryText("cibi loan 100000 for swathis on 2026-12-01"), {
  who: "cibi", intent: "Give a loan", amountRaw: "100000", treasurer: "swathis", principal: undefined, date: "2026-12-01", note: undefined,
});
// Amount shorthand: 100000 and 1L are the same loan.
assert.equal(parseEntryText("cibi loan 100000 for swathis")?.amountRaw, "100000");
assert.equal(parseEntryText("cibi loan 1L for swathis")?.amountRaw, "1L");

// Dates: every common separator + order normalises to yyyy-mm-dd.
assert.equal(parseEntryText("cibi loan 1L for swathis on 2026/12/01")?.date, "2026-12-01");
assert.equal(parseEntryText("cibi loan 1L for swathis on 01-12-2026")?.date, "2026-12-01");
assert.equal(parseEntryText("cibi loan 1L for swathis on 1.12.2026")?.date, "2026-12-01");
assert.equal(parseEntryText("cibi loan 1L for swathis on 2026.12.01")?.date, "2026-12-01");
// A shaped-but-impossible date (month 13) is rejected so the bot flags it rather than posting today.
assert.equal(parseEntryText("cibi loan 1L for swathis on 2026-13-01"), null);
assert.match(entryMissing("cibi loan 1L for swathis on 2026-13-01"), /date/);

// normalizeDate covers query contexts too (textual months, day-first).
assert.equal(normalizeDate("2026-12-01"), "2026-12-01");
assert.equal(normalizeDate("2026/12/01"), "2026-12-01");
assert.equal(normalizeDate("01/12/2026"), "2026-12-01");
assert.equal(normalizeDate("15th July 2026"), "2026-07-15");
assert.equal(normalizeDate("Jul 15 2026"), "2026-07-15");
assert.equal(normalizeDate("not a date"), null);

// List commands and bare keywords must NOT look like entries (they route to the query switch)
for (const s of ["balance", "balance ravi", "loan", "help", "what did ravi pay", "txns july", "catchup", "penalty", "catchup ravi", "penalty ravi", "members", "pending"]) {
  assert.equal(looksLikeEntryStart(s), false, `should not look like entry: "${s}"`);
}

console.log("whatsapp parse: all checks passed");
