import { MembersList } from "@/features/members/components/members-list";
import { getMembers, getMemberSummary } from "@/server/queries/members";

export default async function MembersPage() {
  const [members, summary] = await Promise.all([getMembers(), getMemberSummary()]);
  return <MembersList members={members} summary={summary} />;
}
