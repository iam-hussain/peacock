// Client-safe contract for the notifications feature — no `server-only`/prisma imports, so client
// components can share these without dragging the query bundle (and next/headers) into the browser.

/** Page size for the activity feed ("Load more"). */
export const ACTIVITY_PAGE = 8;

export interface ActivityEvent {
  title: string;
  sub: string;
  time: string;
  amt: string;
  dir: string;
}

export interface NotificationsData {
  approvals: { id: string; who: string; type: string; sub: string; amt: string; dir: string; creator: string; treasurer: string; method: string; txn: string; created: string }[];
  alerts: { title: string; sub: string }[];
  events: ActivityEvent[];
  summary: { label: string; v: string; color: string }[];
}
