// Static UI config for the dashboard. Financial data comes from server/queries/dashboard.
export const CHART_RANGES = ["3M", "1Y", "All"] as const;
export const CHART_DEFAULT = "1Y";

export const DASH_TABS = ["Transactions", "Vendors", "Trends"] as const;

export type Dir = "in" | "out" | "neutral";
