// Static UI config for the dashboard. Financial data comes from server/queries/dashboard.
export const CHART_RANGES = ["3M", "1Y", "All"] as const;
export const CHART_DEFAULT = "1Y";

export const DASH_TABS = ["Transactions", "Vendors", "Trends"] as const;

// Recent-activity feed length: full on web, trimmed on mobile.
export const DASH_ACTIVITY_WEB = 14;
export const DASH_ACTIVITY_MOBILE = 8;

export type Dir = "in" | "out" | "neutral";
