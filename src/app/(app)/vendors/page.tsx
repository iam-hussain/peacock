import { VendorsList } from "@/features/vendors/components/vendors-list";
import { getVendors, getVendorStats } from "@/server/queries/vendors";

export default async function VendorsPage() {
  const [vendors, stats] = await Promise.all([getVendors(), getVendorStats()]);
  return <VendorsList vendors={vendors} stats={stats} />;
}
