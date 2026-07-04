"use server";

import { z } from "zod";
import { AN_RANGES, AN_METRIC_LABELS, getGraphSeries, type GraphSeries } from "@/server/queries/analytics";

const schema = z.object({
  metric: z.enum(AN_METRIC_LABELS as [string, ...string[]]),
  range: z.enum(AN_RANGES),
});

export async function fetchSeries(input: { metric: string; range: string }): Promise<GraphSeries> {
  const { metric, range } = schema.parse(input);
  return getGraphSeries(metric, range);
}
