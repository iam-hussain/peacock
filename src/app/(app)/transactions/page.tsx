"use client";

import { BrandLoader } from "@/components/shared/brand-loader";
import { Transactions } from "@/features/transactions/components/transactions";
import { usePageQuery } from "@/lib/use-page-query";
import type { TxnDTO } from "@/server/queries/transactions";

export default function TransactionsPage() {
  const { data, error } = usePageQuery<TxnDTO[]>(["transactions"], "/api/transactions");
  if (error) throw error;
  if (!data) return <BrandLoader />;
  return <Transactions ledger={data} />;
}
