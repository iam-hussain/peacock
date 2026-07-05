"use client";

import { BrandLoader } from "@/components/shared/brand-loader";
import { Share } from "@/features/share/components/share";
import { usePageQuery } from "@/lib/use-page-query";
import type { ShareData } from "@/server/queries/share";

export default function SharePage() {
  const { data, error } = usePageQuery<ShareData>(["share"], "/api/share");
  if (error) throw error;
  if (!data) return <BrandLoader />;
  return <Share data={data} />;
}
