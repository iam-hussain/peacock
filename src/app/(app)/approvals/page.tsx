"use client";

import { BrandLoader } from "@/components/shared/brand-loader";
import { ApprovalsQueue } from "@/features/notifications/components/approvals-queue";
import { usePageQuery } from "@/lib/use-page-query";
import type { NotificationsData } from "@/features/notifications/types";

export default function ApprovalsPage() {
  const { data, error } = usePageQuery<NotificationsData>(["notifications"], "/api/notifications");
  if (error) throw error;
  if (!data) return <BrandLoader />;
  return <ApprovalsQueue approvals={data.approvals} />;
}
