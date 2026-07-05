"use client";

import { BrandLoader } from "@/components/shared/brand-loader";
import { LoansList } from "@/features/loans/components/loans-list";
import { usePageQuery } from "@/lib/use-page-query";
import type * as Q from "@/server/queries/loans";

type Data = {
  loans: Awaited<ReturnType<typeof Q.getLoans>>;
  stats: Awaited<ReturnType<typeof Q.getLoanStats>>;
  rate: Awaited<ReturnType<typeof Q.getCurrentRate>>;
  eligibility: Awaited<ReturnType<typeof Q.getLoanEligibility>>;
};

export default function LoansPage() {
  const { data, error } = usePageQuery<Data>(["loans"], "/api/loans");
  if (error) throw error;
  if (!data) return <BrandLoader />;
  return <LoansList loans={data.loans} stats={data.stats} rate={data.rate} eligibility={data.eligibility} />;
}
