import { z } from "zod";
import { guarded } from "@/server/api";
import { getTransactionsPage } from "@/server/queries/transactions";

const params = z.object({
  q: z.string().optional(),
  type: z.string().optional(),
  party: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  page: z.coerce.number().int().min(1).catch(1),
  size: z.coerce.number().int().min(1).max(100).catch(25),
});

export const GET = (req: Request) =>
  guarded(() => getTransactionsPage(params.parse(Object.fromEntries(new URL(req.url).searchParams))));
