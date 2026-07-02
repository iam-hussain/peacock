import { notFound } from "next/navigation";
import { LoanDetailView } from "@/features/loans/components/loan-detail";
import { getLoanDetail, getLoanIds } from "@/server/queries/loans";

export async function generateStaticParams() {
  const ids = await getLoanIds();
  return ids.map((id) => ({ id }));
}

export default async function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = await getLoanDetail(id);
  if (!l) notFound();
  return <LoanDetailView l={l} />;
}
