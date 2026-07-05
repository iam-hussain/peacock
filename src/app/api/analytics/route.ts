import { NextResponse } from "next/server";
import { guarded } from "@/server/api";
import { cachedStats } from "@/server/stats";
import { AN_METRIC_LABELS, AN_RANGES, getGraphSeries, type Range } from "@/server/queries/analytics";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const metric = url.searchParams.get("metric") ?? "";
  const range = url.searchParams.get("range") ?? "";
  return guarded(async () => {
    if (!(AN_METRIC_LABELS as readonly string[]).includes(metric) || !(AN_RANGES as readonly string[]).includes(range)) {
      return NextResponse.json({ error: "Unknown metric or range." }, { status: 400 });
    }
    return cachedStats(`analytics:${metric}:${range}`, () => getGraphSeries(metric, range as Range));
  });
}
