// Stub analytics series. Replaced by server/queries when the API is wired.
export const AN_METRIC = { label: "Portfolio value", group: "Club totals" };
export const AN_RANGES = ["1M", "3M", "6M", "1Y", "ALL"] as const;

// grouped metric catalogue for the picker
export const AN_METRIC_GROUPS: { group: string; metrics: string[] }[] = [
  { group: "Club totals", metrics: ["Portfolio value", "Total deposits", "Cash in hand"] },
  { group: "Lending", metrics: ["Loans outstanding", "Interest collected"] },
  { group: "Vendors", metrics: ["Vendor returns"] },
  { group: "Membership", metrics: ["Member count"] },
];
export const AN_DEFAULT = "1Y";
export const AN_CHIPS = ["Deposits", "Loans out", "Vendor ROI"];
