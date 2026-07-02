import { Transactions } from "@/features/transactions/components/transactions";
import { getTransactions } from "@/server/queries/transactions";

export default async function TransactionsPage() {
  const ledger = await getTransactions();
  return <Transactions ledger={ledger} />;
}
