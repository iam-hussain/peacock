// Client-side metric catalogue for the picker. Labels MUST match the METRICS map in
// server/queries/analytics.ts (that file computes each series; this one only lists/groups them).
export const AN_RANGES = ["1M", "3M", "6M", "1Y", "ALL"] as const;
export const AN_DEFAULT_RANGE = "ALL";
export const AN_DEFAULT_METRIC = "Total Portfolio Value";

export const AN_METRIC_GROUPS: { group: string; metrics: string[] }[] = [
  { group: "Club totals", metrics: ["Total Portfolio Value", "Available Cash"] },
  { group: "Members", metrics: ["Member Deposits", "Active Members"] },
  { group: "Lending", metrics: ["Current Loan Taken", "Total Loan Given", "Total Interest Collected"] },
  { group: "Vendors", metrics: ["Vendor Investment", "Vendor Profit"] },
];

// quick-access chips (design §8.3.B) — three headline metrics
export const AN_CHIPS = ["Total Portfolio Value", "Available Cash", "Total Interest Collected"];

export function groupOf(metric: string): string {
  return AN_METRIC_GROUPS.find((g) => g.metrics.includes(metric))?.group ?? "";
}
