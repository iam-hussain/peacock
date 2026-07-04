import type { Member } from "./data";

export type MemberFilter = "all" | "active" | "inactive";

export const MEMBER_FILTER_LABELS: Record<MemberFilter, string> = {
  all: "All members",
  active: "Active",
  inactive: "Inactive",
};

/** Filter members by a free-text name query and their active/inactive status. */
export function filterMembers(members: Member[], query: string, filter: MemberFilter): Member[] {
  const q = query.trim().toLowerCase();
  return members.filter((m) => {
    const matchesText = !q || m.name.toLowerCase().includes(q);
    const matchesStatus = filter === "all" || (filter === "active" ? m.status === "active" : m.status !== "active");
    return matchesText && matchesStatus;
  });
}
