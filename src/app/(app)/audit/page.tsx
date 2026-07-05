"use client";

import { BrandLoader } from "@/components/shared/brand-loader";
import { Audit } from "@/features/audit/components/audit";
import { usePageQuery } from "@/lib/use-page-query";
import type * as Q from "@/server/queries/audit";

type Data = Awaited<ReturnType<typeof Q.getAuditFeed>>;

export default function AuditPage() {
  const { data, error } = usePageQuery<Data>(["audit"], "/api/audit");
  if (error) throw error;
  if (!data) return <BrandLoader />;
  return <Audit groups={data.groups} total={data.total} />;
}
