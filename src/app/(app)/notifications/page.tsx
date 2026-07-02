import { Notifications } from "@/features/notifications/components/notifications";
import { getNotifications } from "@/server/queries/notifications";

export default async function NotificationsPage() {
  const { approvals, alerts, events, summary } = await getNotifications();
  return <Notifications approvals={approvals} alerts={alerts} events={events} summary={summary} />;
}
