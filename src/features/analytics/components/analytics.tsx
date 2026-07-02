"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AnalyticsData } from "@/server/queries/analytics";
import { AN_METRIC, AN_RANGES, AN_DEFAULT, AN_CHIPS } from "../data";
import { MetricPicker } from "./metric-picker";
import { AxisChart } from "./axis-chart";

type AnalyticsProps = Pick<AnalyticsData, "hero" | "stats" | "breakdown" | "series" | "months">;

export function Analytics({ hero, stats, breakdown, series, months }: AnalyticsProps) {
  const [range, setRange] = useState<string>(AN_DEFAULT);
  const [metric, setMetric] = useState<string>(AN_METRIC.label);
  const [breakdownOpen, setBreakdownOpen] = useState(true);
  return (
    <div className="mx-auto max-w-[1280px] p-4 pb-[78px] md:p-[26px] md:pb-[26px]">
      {/* Title — desktop only (mobile top-bar shows "Analytics"); keep the subtext */}
      <div className="mb-[18px]">
        <h1 className="hidden text-2xl font-bold leading-none tracking-[-0.02em] text-ink md:block">Analytics</h1>
        <p className="text-[13px] font-medium leading-[1.4] text-mut md:mt-[7px]">Track any club metric over time.</p>
      </div>

      {/* Panel — a card on desktop, bare on mobile ("no card") */}
      <div className="md:rounded-[18px] md:border md:border-bd md:bg-sf md:p-[26px] md:shadow-[0_1px_2px_var(--shadow)]">
        {/* metric + range */}
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-start md:justify-between md:gap-5">
          <MetricPicker metric={metric} onSelect={setMetric} />
          <div className="flex w-full gap-1 rounded-[10px] md:w-auto md:bg-bg2 md:p-1">
            {AN_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`flex-1 rounded-lg px-3 py-2.5 text-[12px] font-semibold leading-none transition-colors md:flex-none md:py-2 md:text-[11px] ${
                  range === r ? "bg-sf text-ink shadow-[0_1px_2px_var(--shadow)]" : "text-mut"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* quick chips — desktop only */}
        <div className="mt-3.5 hidden flex-wrap items-center gap-2 md:flex">
          <span className="mr-0.5 text-[11px] font-semibold leading-none text-fnt">Quick:</span>
          {AN_CHIPS.map((c) => (
            <button
              key={c}
              className="rounded-lg border border-bd2 bg-sf px-3 py-2 text-[11px] font-semibold leading-none text-mut hover:bg-sf2"
            >
              {c}
            </button>
          ))}
        </div>

        {/* hero */}
        <div className="mt-6 flex flex-wrap items-end gap-[18px]">
          <div className="font-mono text-[44px] font-semibold leading-[0.95] tracking-[-0.01em] text-ink">
            {hero.value}
          </div>
          <div className="flex items-center gap-2.5 pb-[5px]">
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-bold leading-none ${
                hero.positive ? "bg-tlsf text-in" : "bg-outbg text-out"
              }`}
            >
              {hero.changeArrow} {hero.changePct}
            </span>
            <span className={`font-mono text-[13px] font-semibold leading-none ${hero.positive ? "text-in" : "text-out"}`}>
              {hero.changeAbs}
            </span>
            <span className="text-xs font-medium leading-none text-fnt">{hero.caption}</span>
          </div>
        </div>
        <div className="mt-3 flex gap-[18px] text-xs font-medium leading-none text-mut">
          <span>high <span className="font-mono font-semibold text-ink">{stats.high}</span></span>
          <span>low <span className="font-mono font-semibold text-ink">{stats.low}</span></span>
          <span>avg <span className="font-mono font-semibold text-ink">{stats.avg}</span></span>
        </div>

        {/* chart — carded on mobile, inline in the panel on desktop */}
        <div className="mt-4 rounded-[18px] border border-bd bg-sf p-4 shadow-[0_1px_2px_var(--shadow)] md:mt-6 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none">
          <AxisChart data={series} months={months} />
        </div>
      </div>

      {/* breakdown */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-bd bg-sf shadow-[0_1px_2px_var(--shadow)]">
        <button
          onClick={() => setBreakdownOpen((o) => !o)}
          className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-bg"
          aria-expanded={breakdownOpen}
        >
          <span className="text-sm font-bold leading-none text-ink">{breakdown.title}</span>
          <ChevronDown
            className={`size-4 text-mut transition-transform ${breakdownOpen ? "rotate-180" : ""}`}
            strokeWidth={2.2}
          />
        </button>
        {breakdownOpen && (
          <div className="flex flex-col gap-3.5 px-5 pb-[18px] pt-1">
            {breakdown.rows.map((row) => (
              <div key={row.name}>
                <div className="mb-[7px] flex items-center justify-between">
                  <span className="text-[13px] font-semibold leading-none text-ink">{row.name}</span>
                  <span className="font-mono text-[13px] font-semibold leading-none text-ink">{row.disp}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-[5px] bg-bg2">
                  <div className="h-full rounded-[5px] bg-teal" style={{ width: `${row.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
