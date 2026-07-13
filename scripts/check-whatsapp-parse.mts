// Self-check for the WhatsApp entry grammar: `npx tsx scripts/check-whatsapp-parse.mts`
import assert from "node:assert";
import { parseEntryText } from "../src/server/whatsapp/parse";

// Valid shapes
assert.deepEqual(parseEntryText("ravi paid 2000"), { who: "ravi", intent: "Member paid deposit", amountRaw: "2000", treasurer: undefined, date: undefined });
assert.deepEqual(parseEntryText("Ravi Kumar repaid ₹5,000 to Suresh"), { who: "Ravi Kumar", intent: "Record repayment", amountRaw: "₹5,000", treasurer: "Suresh", date: undefined });
assert.deepEqual(parseEntryText("ravi interest 500 on 2026-07-01"), { who: "ravi", intent: "Collect interest", amountRaw: "500", treasurer: undefined, date: "2026-07-01" });
assert.deepEqual(parseEntryText("  ravi PAID 5.5L to suresh on 2026-06-15  ")?.amountRaw, "5.5L");

// Queries and junk must NOT parse as entries
for (const s of ["balance", "balance ravi", "loan", "help", "ravi paid", "paid 2000", "ravi paid abc", "what did ravi pay"]) {
  assert.equal(parseEntryText(s), null, `should not parse: "${s}"`);
}

console.log("whatsapp parse: all checks passed");
