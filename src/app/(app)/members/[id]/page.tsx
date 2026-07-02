import { notFound } from "next/navigation";
import { MemberDetailView } from "@/features/members/components/member-detail";
import { getMemberDetail, getMemberIds } from "@/server/queries/members";

export async function generateStaticParams() {
  const ids = await getMemberIds();
  return ids.map((id) => ({ id }));
}

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getMemberDetail(id);
  if (!m) notFound();
  return <MemberDetailView m={m} />;
}
