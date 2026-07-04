/**
 * Money is integer paise everywhere on the server. Format to ₹ only at display.
 * These helpers cover form parsing + basic display; the ledger read-engine (deposits
 * vs profit vs pending splits) lands with the query layer.
 */

/** Round paise to the nearest whole rupee (100 paise). Loan interest is reported in whole
 * rupees (IMPLEMENTATION_PLAN §14.3); ties round up. Sign-preserving. */
export function roundToWholeRupee(paise: bigint): bigint {
  const sign = paise < 0n ? -1n : 1n;
  const abs = paise < 0n ? -paise : paise;
  const rem = abs % 100n;
  const rounded = rem >= 50n ? abs - rem + 100n : abs - rem;
  return sign * rounded;
}

/**
 * A member's profit share (PRODUCT.md §11). Pooled club profit is split against the EXPECTED
 * deposit base — `members × expectedPerMember` — NOT what members have actually paid in. Properties:
 *   • a fully-paid member (deposits = expectedPerMember) always gets the full per-head share
 *     `clubProfit ÷ members`, unaffected by how far behind anyone else is;
 *   • an underpaid member gets `paidRatio ×` that, bearing their own shortfall alone;
 *   • Σ over all members = clubProfit × (totalPaid / totalExpected) ≤ clubProfit — the club never
 *     distributes more profit than it earned, so it can't go negative even if everyone settles.
 * The un-earned remainder stays pooled until the underpayer catches up.
 */
export function profitShare(clubProfit: bigint, deposits: bigint, members: number, expectedPerMember: bigint): bigint {
  const base = BigInt(members) * expectedPerMember;
  return base > 0n ? (clubProfit * deposits) / base : 0n;
}

/** Parse a user-entered rupee string ("₹4,20,000", "5.5L", "25000") to integer paise. */
export function rupeesToPaise(input: string | number): bigint {
  if (typeof input === "number") return BigInt(Math.round(input * 100));
  const raw = input.trim().toLowerCase();
  if (!raw) return BigInt(0);
  const mult = raw.endsWith("l") ? 100000 : raw.endsWith("cr") ? 10000000 : 1;
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? BigInt(Math.round(n * mult * 100)) : BigInt(0);
}

/** Format integer paise to a grouped ₹ string, e.g. 4820000_00 → "₹48,20,000". */
export function formatPaise(paise: bigint | number): string {
  const rupees = Math.round(Number(paise) / 100);
  return "₹" + new Intl.NumberFormat("en-IN").format(rupees);
}

/** Compact ₹ for dense cards: ≥1cr → "₹1.2Cr", ≥1L → "₹4.82L", else grouped. */
export function formatLakh(paise: bigint | number): string {
  const rupees = Math.round(Number(paise) / 100);
  const abs = Math.abs(rupees);
  const sign = rupees < 0 ? "−" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${trim(abs / 1_00_00_000)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${trim(abs / 1_00_000)}L`;
  if (abs >= 1_000) return `${sign}₹${trim(abs / 1_000)}K`;
  return sign + "₹" + new Intl.NumberFormat("en-IN").format(abs);
}

// drop a trailing ".0" but keep one decimal otherwise (4.8 → "4.8", 5.0 → "5")
function trim(n: number): string {
  const s = n.toFixed(n < 10 ? 2 : 1);
  return s.replace(/\.?0+$/, "");
}

/** Signed ₹ with a leading + / − and the tone, for ledger rows. */
export function formatSigned(paise: bigint | number): { text: string; dir: "in" | "out" | "neutral" } {
  const n = Number(paise);
  if (n === 0) return { text: formatPaise(0), dir: "neutral" };
  const body = formatPaise(Math.abs(n));
  return n > 0 ? { text: "+" + body, dir: "in" } : { text: "−" + body, dir: "out" };
}
