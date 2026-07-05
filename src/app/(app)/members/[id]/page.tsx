import { MemberDetailClient } from "./member-detail-client";

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemberDetailClient id={id} />;
}
