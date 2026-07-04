import { Analytics } from "@/features/analytics/components/analytics";
import { getGraphSeries } from "@/server/queries/analytics";
import { AN_DEFAULT_METRIC, AN_DEFAULT_RANGE } from "@/features/analytics/data";

export default async function AnalyticsPage() {
  const initial = await getGraphSeries(AN_DEFAULT_METRIC, AN_DEFAULT_RANGE);
  return <Analytics initial={initial} />;
}
