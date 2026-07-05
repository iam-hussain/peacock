import { MembersList } from "@/features/members/components/members-list";
import { getMembers, getJoinPreview } from "@/server/queries/members";

export default async function MembersPage() {
  const [members, joinPreview] = await Promise.all([getMembers(), getJoinPreview()]);
  return <MembersList members={members} joinPreview={joinPreview} />;
}
