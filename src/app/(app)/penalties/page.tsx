"use client";

import { BrandLoader } from "@/components/shared/brand-loader";
import { AutoPenalties } from "@/features/penalties/components/auto-penalties";
import { usePageQuery } from "@/lib/use-page-query";
import type * as Q from "@/server/queries/penalties";

type Data = Awaited<ReturnType<typeof Q.getAutoPenaltiesData>>;

export default function PenaltiesPage() {
  const { data, error } = usePageQuery<Data>(["penalties"], "/api/penalties");
  if (error) return <AutoPenalties error={error.message} />;
  if (!data) return <BrandLoader />;
  return <AutoPenalties data={data} />;
}
