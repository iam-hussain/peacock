import { guarded } from "@/server/api";
import { cachedStats } from "@/server/stats";
import { getTransactions } from "@/server/queries/transactions";

export const GET = () => guarded(() => cachedStats("transactions", () => getTransactions()));
