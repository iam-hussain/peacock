"use client";

import { BrandLoader } from "@/components/shared/brand-loader";
import { MembersList } from "@/features/members/components/members-list";
import { usePageQuery } from "@/lib/use-page-query";
import type * as Q from "@/server/queries/members";

type Data = { members: Awaited<ReturnType<typeof Q.getMembers>>; joinPreview: Awaited<ReturnType<typeof Q.getJoinPreview>> };

export default function MembersPage() {
  const { data, error } = usePageQuery<Data>(["members"], "/api/members");
  if (error) throw error;
  if (!data) return <BrandLoader />;
  return <MembersList members={data.members} joinPreview={data.joinPreview} />;
}
