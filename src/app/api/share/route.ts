import { guarded } from "@/server/api";
import { cachedStats } from "@/server/stats";
import { getShareData } from "@/server/queries/share";

export const GET = () => guarded(() => cachedStats("share", getShareData));
