import { guarded } from "@/server/api";
import { cachedStats } from "@/server/stats";
import { getLoans, getLoanStats, getCurrentRate, getLoanEligibility } from "@/server/queries/loans";

export const GET = () =>
  guarded(() =>
    cachedStats("loans", async () => {
      const [loans, stats, rate, eligibility] = await Promise.all([getLoans(), getLoanStats(), getCurrentRate(), getLoanEligibility()]);
      return { loans, stats, rate, eligibility };
    }),
  );
