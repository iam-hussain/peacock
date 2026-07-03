import { Settings } from "@/features/settings/components/settings";
import { getSettingsData } from "@/server/queries/settings";
import { getCurrentUser } from "@/server/queries/session";

export default async function SettingsPage() {
  const [data, me] = await Promise.all([getSettingsData(), getCurrentUser()]);
  return <Settings {...data} isAdmin={!!me?.isAdmin} />;
}
