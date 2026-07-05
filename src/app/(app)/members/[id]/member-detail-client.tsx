"use client";

import { BrandLoader } from "@/components/shared/brand-loader";
import { MemberDetailView } from "@/features/members/components/member-detail";
import { usePageQuery } from "@/lib/use-page-query";
import type { MemberDetailDTO } from "@/server/queries/members";

export function MemberDetailClient({ id }: { id: string }) {
  const { data, error } = usePageQuery<MemberDetailDTO>(["member", id], `/api/members/${id}`);
  if (error) throw error;
  if (!data) return <BrandLoader />;
  return <MemberDetailView m={data} />;
}
