"use client";

import { BrandLoader } from "@/components/shared/brand-loader";
import { AdminHub } from "@/features/admin/components/admin-hub";
import { usePageQuery } from "@/lib/use-page-query";
import type * as Q from "@/server/queries/settings";

type Data = Awaited<ReturnType<typeof Q.getSettingsData>> & { isAdmin: boolean };

export default function AdminPage() {
  const { data, error } = usePageQuery<Data>(["settings"], "/api/settings");
  if (error) throw error;
  if (!data) return <BrandLoader />;
  return <AdminHub data={data} />;
}
