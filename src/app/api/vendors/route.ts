import { guarded } from "@/server/api";
import { cachedStats } from "@/server/stats";
import { getVendors, getVendorStats } from "@/server/queries/vendors";

export const GET = () =>
  guarded(() =>
    cachedStats("vendors", async () => {
      const [vendors, stats] = await Promise.all([getVendors(), getVendorStats()]);
      return { vendors, stats };
    }),
  );
