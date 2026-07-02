import { Audit } from "@/features/audit/components/audit";
import { getAuditFeed } from "@/server/queries/audit";

export default async function AuditPage() {
  const { groups, total } = await getAuditFeed();
  return <Audit groups={groups} total={total} />;
}
