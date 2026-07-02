import { redirect } from "next/navigation";
import { MoreMenu } from "@/features/app-shell/components/more-menu";
import { getCurrentUser } from "@/server/queries/session";

export default async function MorePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <MoreMenu user={user} />;
}
