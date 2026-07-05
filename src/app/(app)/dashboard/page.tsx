"use client";

import { Dashboard } from "@/features/dashboard/components/dashboard";
import { DashboardSkeleton } from "@/features/dashboard/components/dashboard-skeleton";
import { usePageQuery } from "@/lib/use-page-query";
import type { DashboardData } from "@/server/queries/dashboard";
import type { CurrentUser } from "@/server/queries/session";

export default function DashboardPage() {
  const { data, error } = usePageQuery<DashboardData>(["dashboard"], "/api/dashboard");
  const me = usePageQuery<{ user: CurrentUser; unread: number }>(["me"], "/api/me");
  if (error) throw error;
  if (!data) return <DashboardSkeleton />;

  const hour = new Date().getHours(); // the viewer's own clock decides the greeting
  const partOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const y = Math.floor(data.clubAgeMonths / 12);
  const m = data.clubAgeMonths % 12;
  const age = y ? `${y}y${m ? ` ${m}m` : ""}` : `${m}m`;
  const members = `${data.activeMembers} active member${data.activeMembers === 1 ? "" : "s"}`;
  const greeting = {
    hello: `Good ${partOfDay}, ${me.data?.user.firstName ?? ""}`,
    sub: `${members} · ${age} old`,
  };
  return <Dashboard data={data} greeting={greeting} />;
}
