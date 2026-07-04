import { Suspense } from "react";
import { Dashboard } from "@/features/dashboard/components/dashboard";
import { DashboardSkeleton } from "@/features/dashboard/components/dashboard-skeleton";
import { getDashboard } from "@/server/queries/dashboard";
import { getCurrentUser } from "@/server/queries/session";

export default function DashboardPage() {
  // The heavy, DB-bound dashboard data streams inside a Suspense boundary: the app shell paints
  // immediately and a dashboard-shaped skeleton fills the content area until the data resolves.
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const [data, user] = await Promise.all([getDashboard(), getCurrentUser()]);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  const partOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const y = Math.floor(data.clubAgeMonths / 12);
  const m = data.clubAgeMonths % 12;
  const age = y ? `${y}y${m ? ` ${m}m` : ""}` : `${m}m`;
  const members = `${data.activeMembers} active member${data.activeMembers === 1 ? "" : "s"}`;
  const greeting = {
    hello: `Good ${partOfDay}, ${user?.firstName ?? ""}`,
    sub: `${members} · ${age} old`,
  };
  return <Dashboard data={data} greeting={greeting} />;
}
