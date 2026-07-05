import { guarded } from "@/server/api";
import { cachedStats } from "@/server/stats";
import { getDashboard } from "@/server/queries/dashboard";

export const GET = () => guarded(() => cachedStats("dashboard", getDashboard));
