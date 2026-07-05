import { guarded } from "@/server/api";
import { cachedStats } from "@/server/stats";
import { getAuditFeed } from "@/server/queries/audit";

export const GET = () => guarded(() => cachedStats("audit", getAuditFeed));
