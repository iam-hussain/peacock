"use client";

import { BrandLoader } from "@/components/shared/brand-loader";
import { VendorsList } from "@/features/vendors/components/vendors-list";
import { usePageQuery } from "@/lib/use-page-query";
import type * as Q from "@/server/queries/vendors";

type Data = { vendors: Awaited<ReturnType<typeof Q.getVendors>>; stats: Awaited<ReturnType<typeof Q.getVendorStats>> };

export default function VendorsPage() {
  const { data, error } = usePageQuery<Data>(["vendors"], "/api/vendors");
  if (error) throw error;
  if (!data) return <BrandLoader />;
  return <VendorsList vendors={data.vendors} stats={data.stats} />;
}
