import { notFound } from "next/navigation";
import { ChitDetailView, GeneralDetailView } from "@/features/vendors/components/vendor-detail";
import { getChitDetail, getGeneralDetail, getVendorIds } from "@/server/queries/vendors";

export async function generateStaticParams() {
  const ids = await getVendorIds();
  return ids.map((id) => ({ id }));
}

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getChitDetail(id);
  if (c) return <ChitDetailView c={c} />;
  const g = await getGeneralDetail(id);
  if (g) return <GeneralDetailView g={g} />;
  notFound();
}
