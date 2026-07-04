/**
 * Runnable check for the money primitives — no framework.
 *   node --import tsx src/lib/money.check.mts
 * Focus: roundToWholeRupee (the new whole-rupee rounding for loan interest, §14.3) — ties round up,
 * sign-preserving. Interest figures are reported through this, so a rounding bug mis-states profit.
 */
import { roundToWholeRupee, rupeesToPaise, profitShare } from "./money";

let failed = 0;
const eq = (got: bigint, want: bigint, label: string) => {
  if (got !== want) { console.error(`✗ ${label}: got ${got}, want ${want}`); failed++; }
  else console.log(`✓ ${label}`);
};

// exact rupees pass through
eq(roundToWholeRupee(5000_00n), 5000_00n, "exact rupee unchanged");
// < 50 paise rounds down, >= 50 rounds up (tie)
eq(roundToWholeRupee(5000_49n), 5000_00n, "49 paise rounds down");
eq(roundToWholeRupee(5000_50n), 5001_00n, "50 paise (tie) rounds up");
eq(roundToWholeRupee(5000_99n), 5001_00n, "99 paise rounds up");
// sign preserved (an overpaid credit)
eq(roundToWholeRupee(-5000_50n), -5001_00n, "negative tie rounds away from zero");
eq(roundToWholeRupee(-5000_49n), -5000_00n, "negative <50 rounds toward zero");
eq(roundToWholeRupee(0n), 0n, "zero");

// §9 worked example: ₹50,000 at 1%/mo, 2 full months = ₹1,000 interest, already whole → unchanged.
const monthly = rupeesToPaise(50000) * 100n / 10000n; // 1% of 50,000 = ₹500
eq(roundToWholeRupee(monthly * 2n), 1000_00n, "§9: two full months = ₹1,000");

// --- profitShare (PRODUCT.md §11): expected-base split ---
// Setup: 3 members, each expected ₹1,00,000, pool ₹30,000. Full per-head share = ₹10,000.
const POOL = 30000_00n, E = 100000_00n, N = 3;
eq(profitShare(POOL, E, N, E), 10000_00n, "§11: fully-paid member gets full per-head share (pool ÷ members)");
eq(profitShare(POOL, 50000_00n, N, E), 5000_00n, "§11: 50%-paid member gets half the full share");
eq(profitShare(POOL, 0n, N, E), 0n, "§11: unpaid member earns nothing");
// A fully-paid member's share does NOT change when others fall behind (unaffected by the pending).
eq(profitShare(POOL, E, N, E), 10000_00n, "§11: full-payer unaffected by others being behind");
// No over-distribution: with everyone underpaid, Σ shares ≤ pool (club can't go negative on exit).
const sumUnderpaid = profitShare(POOL, 90000_00n, N, E) + profitShare(POOL, 80000_00n, N, E) + profitShare(POOL, 100000_00n, N, E);
if (sumUnderpaid > POOL) { console.error(`✗ §11: Σ shares ${sumUnderpaid} exceeds pool ${POOL}`); failed++; }
else console.log(`✓ §11: Σ shares (${sumUnderpaid}) never exceeds the pool (${POOL})`);
// Everyone fully paid → pool is exactly distributed (no remainder stranded).
eq(profitShare(POOL, E, N, E) * BigInt(N), POOL, "§11: all fully paid → pool distributed exactly");
eq(profitShare(0n, E, 0, E), 0n, "§11: no members / no pool → zero");

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log("\nAll money checks passed.");
