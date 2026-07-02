import { LoansList } from "@/features/loans/components/loans-list";
import { getLoans, getLoanStats, getCurrentRate } from "@/server/queries/loans";

export default async function LoansPage() {
  const [loans, stats, rate] = await Promise.all([getLoans(), getLoanStats(), getCurrentRate()]);
  return <LoansList loans={loans} stats={stats} rate={rate} />;
}
