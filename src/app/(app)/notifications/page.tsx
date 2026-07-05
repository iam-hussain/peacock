"use client";

import { BrandLoader } from "@/components/shared/brand-loader";
import { Notifications } from "@/features/notifications/components/notifications";
import { usePageQuery } from "@/lib/use-page-query";
import type * as Q from "@/server/queries/notifications";

type Data = Awaited<ReturnType<typeof Q.getNotifications>>;

export default function NotificationsPage() {
  const { data, error } = usePageQuery<Data>(["notifications"], "/api/notifications");
  if (error) throw error;
  if (!data) return <BrandLoader />;
  return <Notifications approvals={data.approvals} alerts={data.alerts} events={data.events} summary={data.summary} />;
}
