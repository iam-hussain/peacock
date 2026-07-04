"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import type { GraphSeries } from "@/server/queries/analytics";
import { AN_RANGES, AN_DEFAULT_RANGE, AN_CHIPS } from "../data";
import { fetchSeries } from "../actions";
import { MetricPicker } from "./metric-picker";
import { AxisChart } from "./axis-chart";
import { ChartFullscreen } from "./chart-fullscreen";

export function Analytics({ initial }: { initial: GraphSeries }) {
  const [data, setData] = useState<GraphSeries>(initial);
  const [range, setRange] = useState<string>(AN_DEFAULT_RANGE);
  const [breakdownOpen, setBreakdownOpen] = useState(true);
  const [pending, startTransition] = useTransition();

  function load(metric: string, r: string) {
    setRange(r);
    startTransition(async () => setData(await fetchSeries({ metric, range: r })));
  }

  const { metric, unit, hero, stats, breakdown, points, labels } = data;

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
          <MetricPicker metric={metric} onSelect={(m) => load(m, range)} />
          <div className="flex w-full gap-1 rounded-[10px] md:w-auto md:bg-bg2 md:p-1">
            {AN_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => load(metric, r)}
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
              onClick={() => load(c, range)}
              className={`rounded-lg border px-3 py-2 text-[11px] font-semibold leading-none hover:bg-sf2 ${
                metric === c ? "border-teal bg-tlsf text-teal" : "border-bd2 bg-sf text-mut"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* hero */}
        <div className={`mt-6 flex flex-wrap items-end gap-[18px] transition-opacity ${pending ? "opacity-50" : ""}`}>
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
        {stats && (
          <div className="mt-3 flex gap-[18px] text-xs font-medium leading-none text-mut">
            <span>high <span className="font-mono font-semibold text-ink">{stats.high}</span></span>
            <span>low <span className="font-mono font-semibold text-ink">{stats.low}</span></span>
            <span>avg <span className="font-mono font-semibold text-ink">{stats.avg}</span></span>
          </div>
        )}

        {/* chart — carded on mobile, inline in the panel on desktop */}
        <div className={`relative mt-4 rounded-[18px] border border-bd bg-sf p-4 shadow-[0_1px_2px_var(--shadow)] transition-opacity md:mt-6 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none ${pending ? "opacity-50" : ""}`}>
          <ChartFullscreen data={points} labels={labels} unit={unit} title={metric} value={hero.value} />
          <AxisChart data={points} labels={labels} unit={unit} />
        </div>
      </div>

      {/* breakdown — only for metrics with natural parts */}
      {breakdown && (
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
      )}
    </div>
  );
}
