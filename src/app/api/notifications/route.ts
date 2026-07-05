import { guarded } from "@/server/api";
import { getNotifications } from "@/server/queries/notifications";

// Recipient-specific (approvals target the signed-in admin, read-state is per member) — never
// stats-cached; the queries are light.
export const GET = () => guarded(() => getNotifications());
