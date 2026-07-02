// The member directory row shape is owned by the query layer.
export type { MemberDTO as Member } from "@/server/queries/members";

// Static UI config: table column definitions.
// sort: "updown" = sortable (idle), "down" = active sort (desc), "none" = not sortable
export const MEMBER_COLS = [
  { key: "member", label: "Member", align: "left" as const, sort: "updown" as const },
  { key: "deposits", label: "Deposits", align: "right" as const, sort: "down" as const },
  { key: "profit", label: "Profit", align: "right" as const, sort: "updown" as const },
  { key: "value", label: "Value", align: "right" as const, sort: "updown" as const },
  { key: "held", label: "Held", align: "right" as const, sort: "updown" as const },
  { key: "penalty", label: "Penalty", align: "right" as const, sort: "updown" as const },
  { key: "pending", label: "Pending", align: "right" as const, sort: "updown" as const },
  { key: "status", label: "Status", align: "right" as const, sort: "none" as const },
];
