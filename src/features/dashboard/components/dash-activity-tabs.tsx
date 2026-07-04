import Link from "next/link";
import type { DashboardData } from "@/server/queries/dashboard";
import { DASH_TABS } from "../data";
import { ActivityRow } from "./activity-row";

const SHORTCUTS: Record<(typeof DASH_TABS)[number], string> = {
  Transactions: "/transactions",
  Vendors: "/vendors",
  Trends: "/analytics",
};

/** Mobile dashboard: Transactions / Vendors / Trends shortcut links above a recent-activity list. */
export function DashActivityTabs({ activity }: { activity: DashboardData["activity"] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {DASH_TABS.map((t) => (
          <Link
            key={t}
            href={SHORTCUTS[t]}
            className="flex-1 rounded-xl border border-hair bg-sf py-3 text-center text-[13px] font-semibold leading-none text-mut transition-colors"
          >
            {t}
          </Link>
        ))}
      </div>
      <div className="rounded-[14px] border border-hair bg-sf p-[15px]">
        <h2 className="mb-2 text-[15px] font-bold leading-none text-ink">Recent activity</h2>
        {activity.map((a, i) => (
          <ActivityRow key={i} {...a} compact />
        ))}
      </div>
    </div>
  );
}
