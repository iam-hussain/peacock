import { guarded } from "@/server/api";
import { cachedStats } from "@/server/stats";
import { getMembers, getJoinPreview } from "@/server/queries/members";

export const GET = () =>
  guarded(() =>
    cachedStats("members", async () => {
      const [members, joinPreview] = await Promise.all([getMembers(), getJoinPreview()]);
      return { members, joinPreview };
    }),
  );
