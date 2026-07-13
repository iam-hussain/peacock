"use client"; // renderable inside the client-side Share poster (props stay serializable DTOs)

import { useState } from "react";
import Link from "next/link";
import { StatCard } from "@/components/shared/stat-card";
import { WhatsAppCard } from "@/components/shared/whatsapp-card";
import { PortfolioChart } from "@/components/shared/portfolio-chart";
import { RangeTabs } from "@/components/shared/range-tabs";
import { useInPoster } from "@/lib/poster";
import type { DashboardData } from "@/server/queries/dashboard";
import { CHART_RANGES, CHART_DEFAULT, DASH_ACTIVITY_MOBILE } from "../data";
import { ActivityRow } from "./activity-row";
import { DashActivityTabs } from "./dash-activity-tabs";

type Greeting = { hello: string; sub: string };

export function Dashboard({ data, greeting }: { data: DashboardData; greeting: Greeting }) {
  const { hero, totalPortfolio, groups, chart, activity } = data;
  const inPoster = useInPoster();
  // "Club snapshot" lives only on the share poster; the live dashboard shows it in the greeting instead.
  const shownGroups = inPoster ? groups : groups.filter((g) => g.title !== "Club snapshot");
  return (
    <>
      {/* Desktop (forced in the poster regardless of viewport) */}
      <div className={inPoster ? undefined : "hidden md:block"}>
        <div className="mx-auto max-w-320 p-6.5">
          {!inPoster && <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">{greeting.hello}</h1>}
          {!inPoster && <p className="mb-5 mt-1 text-13 font-medium leading-140 text-mut">{greeting.sub}</p>}

          <div className="mb-4 grid grid-cols-5 gap-3">
            {hero.map((m) => (
              <StatCard key={m.label} label={m.label} value={m.value} sub={m.sub} accent={m.accent} />
            ))}
          </div>

          {inPoster ? (
            // Poster: just the summary groups — no portfolio chart or recent-activity feed.
            <div className="grid grid-cols-3 gap-3.5">
              {groups.map((g) => (
                <GroupCard key={g.title} title={g.title} items={g.items} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-[1.5fr_1fr] gap-4">
              <div className="flex flex-col gap-4">
                <ChartCard data={chart} />
                <div className="grid grid-cols-2 gap-3.5">
                  {shownGroups.map((g) => (
                    <GroupCard key={g.title} title={g.title} items={g.items} />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <WhatsAppCard />
                <ActivityCard activity={activity} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile (never in the poster — it always uses the desktop layout) */}
      {!inPoster && (
      <div className="pb-19.5 md:hidden">
        <div className="px-4 pb-0.5 pt-4">
          <h1 className="text-xl font-bold leading-none tracking-[-0.01em] text-ink">{greeting.hello}</h1>
          <p className="mt-1.25 text-xs font-medium leading-140 text-mut">{greeting.sub}</p>
        </div>
        <div className="flex flex-col gap-3 px-4 py-3.5">
          <WhatsAppCard />

          <div className="rounded-18 bg-teal p-5 text-white">
            <div className="text-11 font-semibold uppercase leading-none tracking-3 text-teal-ink">
              Total portfolio value
            </div>
            <div className="my-3 font-mono text-30 font-semibold leading-none">{totalPortfolio.value}</div>
            <div className="text-xs font-semibold leading-none text-teal-soft">{totalPortfolio.change}</div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {hero.slice(1).map((m) => (
              <StatCard key={m.label} label={m.label} value={m.value} sub={m.sub} accent={m.accent} compact />
            ))}
          </div>

          <ChartCard mobile data={chart} />

          {shownGroups.map((g) => (
            <GroupCard key={g.title} title={g.title} items={g.items} />
          ))}

          <DashActivityTabs activity={activity.slice(0, DASH_ACTIVITY_MOBILE)} />
        </div>
      </div>
      )}
    </>
  );
}

const RANGE_SUBTITLE: Record<string, string> = { "3M": "last 3 months", "1Y": "last 12 months", All: "all time" };

function ChartCard({ data, mobile = false }: { data: Record<string, number[]>; mobile?: boolean }) {
  const [range, setRange] = useState<string>(CHART_DEFAULT);
  const series = data[range] ?? [];
  return (
    <div className={`rounded-14 border border-hair bg-sf ${mobile ? "p-3.75" : "p-4.5"}`}>
      <div className={`flex items-center justify-between ${mobile ? "mb-3" : "mb-3.5"}`}>
        <div>
          <div className={`font-bold leading-none text-ink ${mobile ? "text-13" : "text-sm"}`}>Portfolio value</div>
          <div className={`mt-1.25 font-medium leading-none text-fnt ${mobile ? "text-11" : "text-xs"}`}>
            {RANGE_SUBTITLE[range]}
          </div>
        </div>
        {!useInPoster() && (
          <RangeTabs ranges={CHART_RANGES} value={range} onChange={setRange} compact={mobile} />
        )}
      </div>
      <PortfolioChart data={series} height={mobile ? 120 : 150} gradientId={mobile ? "pgM" : "pgD"} />
    </div>
  );
}

function GroupCard({ title, items }: { title: string; items: { l: string; v: string }[] }) {
  return (
    <div className="rounded-14 border border-hair bg-sf p-4">
      <div className="mb-2.5 text-11 font-semibold uppercase leading-none tracking-5 text-teal">
        {title}
      </div>
      {items.map((r) => (
        <div key={r.l} className="flex items-center justify-between border-t border-hr2 py-1.5">
          <span className="text-xs font-medium leading-none text-mut">{r.l}</span>
          <span className="font-mono text-13 font-semibold leading-none text-ink">{r.v}</span>
        </div>
      ))}
    </div>
  );
}

function ActivityCard({ activity }: { activity: DashboardData["activity"] }) {
  return (
    <div className="rounded-14 border border-hair bg-sf p-4.5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold leading-none text-ink">Recent activity</h2>
        {!useInPoster() && (
          <Link href="/transactions" className="text-xs font-medium leading-none text-teal">
            View all
          </Link>
        )}
      </div>
      {activity.map((a, i) => (
        <ActivityRow key={i} {...a} />
      ))}
    </div>
  );
}
