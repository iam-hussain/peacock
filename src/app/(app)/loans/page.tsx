import { LoansList } from "@/features/loans/components/loans-list";
import { getLoans, getLoanStats, getCurrentRate, getLoanEligibility } from "@/server/queries/loans";

export default async function LoansPage() {
  const [loans, stats, rate, eligibility] = await Promise.all([getLoans(), getLoanStats(), getCurrentRate(), getLoanEligibility()]);
  return <LoansList loans={loans} stats={stats} rate={rate} eligibility={eligibility} />;
}
