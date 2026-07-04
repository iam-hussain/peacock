import { MembersList } from "@/features/members/components/members-list";
import { getMembers, getMemberSummary, getJoinPreview } from "@/server/queries/members";

export default async function MembersPage() {
  const [members, summary, joinPreview] = await Promise.all([getMembers(), getMemberSummary(), getJoinPreview()]);
  return <MembersList members={members} summary={summary} joinPreview={joinPreview} />;
}
