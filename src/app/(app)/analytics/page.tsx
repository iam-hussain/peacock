import { Analytics } from "@/features/analytics/components/analytics";
import { getAnalytics } from "@/server/queries/analytics";

export default async function AnalyticsPage() {
  const { hero, stats, breakdown, series, months } = await getAnalytics();
  return <Analytics hero={hero} stats={stats} breakdown={breakdown} series={series} months={months} />;
}
