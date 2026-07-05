"use client";

import { BrandLoader } from "@/components/shared/brand-loader";
import { Settings } from "@/features/settings/components/settings";
import { usePageQuery } from "@/lib/use-page-query";
import type * as Q from "@/server/queries/settings";

type Data = Awaited<ReturnType<typeof Q.getSettingsData>> & { isAdmin: boolean };

export default function SettingsPage() {
  const { data, error } = usePageQuery<Data>(["settings"], "/api/settings");
  if (error) throw error;
  if (!data) return <BrandLoader />;
  return <Settings {...data} />;
}
