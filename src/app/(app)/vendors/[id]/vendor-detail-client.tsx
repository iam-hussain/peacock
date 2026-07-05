"use client";

import { BrandLoader } from "@/components/shared/brand-loader";
import { ChitDetailView, GeneralDetailView } from "@/features/vendors/components/vendor-detail";
import { usePageQuery } from "@/lib/use-page-query";
import type { VendorDetailPayload } from "@/app/api/vendors/[id]/route";

export function VendorDetailClient({ id }: { id: string }) {
  const { data, error } = usePageQuery<VendorDetailPayload>(["vendor", id], `/api/vendors/${id}`);
  if (error) throw error;
  if (!data) return <BrandLoader />;
  return data.kind === "chit" ? <ChitDetailView c={data.detail} /> : <GeneralDetailView g={data.detail} />;
}
