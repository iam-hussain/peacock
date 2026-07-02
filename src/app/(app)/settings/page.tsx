import { Settings } from "@/features/settings/components/settings";
import { getSettingsData } from "@/server/queries/settings";

export default async function SettingsPage() {
  const { club, treasury, profile, memberOptions } = await getSettingsData();
  return <Settings club={club} treasury={treasury} profile={profile} memberOptions={memberOptions} />;
}
