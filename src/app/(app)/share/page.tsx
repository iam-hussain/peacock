import { Share } from "@/features/share/components/share";
import { getShareData } from "@/server/queries/share";

export default async function SharePage() {
  const data = await getShareData();
  return <Share data={data} />;
}
