import { Dashboard } from "@/features/dashboard/components/dashboard";
import { getDashboard } from "@/server/queries/dashboard";
import { getCurrentUser } from "@/server/queries/session";

export default async function DashboardPage() {
  const [data, user] = await Promise.all([getDashboard(), getCurrentUser()]);
  const greeting = {
    hello: `Good evening, ${user?.firstName ?? ""}`,
    sub: "Here's where the club stands today.",
  };
  return <Dashboard data={data} greeting={greeting} />;
}
