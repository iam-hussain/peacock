import Link from "next/link";
import { StatCard } from "@/components/shared/stat-card";
import { PortfolioChart } from "@/components/shared/portfolio-chart";
import { RangeTabs } from "@/components/shared/range-tabs";
import type { DashboardData } from "@/server/queries/dashboard";
import { CHART_RANGES, CHART_DEFAULT } from "../data";
import { ActivityRow } from "./activity-row";
import { DashActivityTabs } from "./dash-activity-tabs";

type Greeting = { hello: string; sub: string };

export function Dashboard({ data, greeting }: { data: DashboardData; greeting: Greeting }) {
  const { hero, totalPortfolio, groups, chart, activity } = data;
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-[1280px] p-[26px]">
          <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">{greeting.hello}</h1>
          <p className="mb-5 mt-1 text-[13px] font-medium leading-[1.4] text-mut">{greeting.sub}</p>

          <div className="mb-4 grid grid-cols-5 gap-3">
            {hero.map((m) => (
              <StatCard key={m.label} label={m.label} value={m.value} sub={m.sub} accent={m.accent} />
            ))}
          </div>

          <div className="grid grid-cols-[1.5fr_1fr] gap-4">
            <div className="flex flex-col gap-4">
              <ChartCard data={chart} />
              <div className="grid grid-cols-2 gap-3.5">
                {groups.map((g) => (
                  <GroupCard key={g.title} title={g.title} items={g.items} />
                ))}
              </div>
            </div>
            <ActivityCard activity={activity} />
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="pb-[78px] md:hidden">
        <div className="px-4 pb-0.5 pt-4">
          <h1 className="text-xl font-bold leading-none tracking-[-0.01em] text-ink">{greeting.hello}</h1>
          <p className="mt-[5px] text-xs font-medium leading-[1.4] text-mut">{greeting.sub}</p>
        </div>
        <div className="flex flex-col gap-3 px-4 py-3.5">
          <div className="rounded-[18px] bg-teal p-5 text-white">
            <div className="text-[11px] font-semibold uppercase leading-none tracking-[0.03em] text-teal-ink">
              Total portfolio value
            </div>
            <div className="my-3 font-mono text-[30px] font-semibold leading-none">{totalPortfolio.value}</div>
            <div className="text-xs font-semibold leading-none text-teal-soft">{totalPortfolio.change}</div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {hero.slice(1).map((m) => (
              <StatCard key={m.label} label={m.label} value={m.value} sub={m.sub} accent={m.accent} compact />
            ))}
          </div>

          <ChartCard mobile data={chart} />

          {groups.map((g) => (
            <GroupCard key={g.title} title={g.title} items={g.items} />
          ))}

          <DashActivityTabs activity={activity} />
        </div>
      </div>
    </>
  );
}

function ChartCard({ data, mobile = false }: { data: number[]; mobile?: boolean }) {
  return (
    <div className={`rounded-[14px] border border-hair bg-sf ${mobile ? "p-[15px]" : "p-[18px]"}`}>
      <div className={`flex items-center justify-between ${mobile ? "mb-3" : "mb-3.5"}`}>
        <div>
          <div className={`font-bold leading-none text-ink ${mobile ? "text-[13px]" : "text-sm"}`}>Portfolio value</div>
          <div className={`mt-[5px] font-medium leading-none text-fnt ${mobile ? "text-[11px]" : "text-xs"}`}>
            last 12 months
          </div>
        </div>
        <RangeTabs ranges={CHART_RANGES} defaultValue={CHART_DEFAULT} compact={mobile} />
      </div>
      <PortfolioChart data={data} height={mobile ? 120 : 150} gradientId={mobile ? "pgM" : "pgD"} />
    </div>
  );
}

function GroupCard({ title, items }: { title: string; items: { l: string; v: string }[] }) {
  return (
    <div className="rounded-[14px] border border-hair bg-sf p-4">
      <div className="mb-2.5 text-[11px] font-semibold uppercase leading-none tracking-[0.05em] text-teal">
        {title}
      </div>
      {items.map((r) => (
        <div key={r.l} className="flex items-center justify-between border-t border-hr2 py-1.5">
          <span className="text-xs font-medium leading-none text-mut">{r.l}</span>
          <span className="font-mono text-[13px] font-semibold leading-none text-ink">{r.v}</span>
        </div>
      ))}
    </div>
  );
}

function ActivityCard({ activity }: { activity: DashboardData["activity"] }) {
  return (
    <div className="rounded-[14px] border border-hair bg-sf p-[18px]">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold leading-none text-ink">Recent activity</h2>
        <Link href="/transactions" className="text-xs font-medium leading-none text-teal">
          View all
        </Link>
      </div>
      {activity.map((a) => (
        <ActivityRow key={a.who + a.what} {...a} />
      ))}
    </div>
  );
}
