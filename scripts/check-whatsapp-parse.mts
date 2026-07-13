// Self-check for the WhatsApp entry grammar: `npx tsx scripts/check-whatsapp-parse.mts`
import assert from "node:assert";
import { parseEntryText, looksLikeEntryStart, entryMissing } from "../src/server/whatsapp/parse";

// Valid shapes — treasurer is required; date and note optional
assert.deepEqual(parseEntryText("ravi paid 2000 to suresh"), {
  who: "ravi", intent: "Member paid deposit", amountRaw: "2000", treasurer: "suresh", date: undefined, note: undefined,
});
assert.deepEqual(parseEntryText("Ravi Kumar repaid ₹5,000 to Suresh on 2026-07-01"), {
  who: "Ravi Kumar", intent: "Record repayment", amountRaw: "₹5,000", treasurer: "Suresh", date: "2026-07-01", note: undefined,
});
assert.deepEqual(parseEntryText("ravi interest 500 to suresh note june interest"), {
  who: "ravi", intent: "Collect interest", amountRaw: "500", treasurer: "suresh", date: undefined, note: "june interest",
});
assert.equal(parseEntryText("  ravi PAID 5.5L to suresh on 2026-06-15 note big month  ")?.note, "big month");

// Incomplete entries must NOT parse, and the missing-piece hint must name the right gap
assert.equal(parseEntryText("ravi paid 2000"), null);
assert.match(entryMissing("ravi paid 2000"), /treasurer/);
assert.equal(parseEntryText("ravi paid"), null);
assert.match(entryMissing("ravi paid"), /amount/);
assert.ok(looksLikeEntryStart("ravi paid"), "incomplete entries still route to the entry hint");

// Queries and junk must NOT look like entries at all
for (const s of ["balance", "balance ravi", "loan", "help", "what did ravi pay", "txns july"]) {
  assert.equal(looksLikeEntryStart(s), false, `should not look like entry: "${s}"`);
}

console.log("whatsapp parse: all checks passed");
