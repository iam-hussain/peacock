"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { AN_METRIC, AN_METRIC_GROUPS } from "../data";

export function MetricPicker({
  metric,
  onSelect,
}: {
  metric: string;
  onSelect: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return AN_METRIC_GROUPS;
    return AN_METRIC_GROUPS.map((g) => ({
      group: g.group,
      metrics: g.metrics.filter((m) => m.toLowerCase().includes(q)),
    })).filter((g) => g.metrics.length > 0);
  }, [query]);

  const empty = groups.length === 0;

  function close() {
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="relative">
      <button
        onClick={() => (open ? close() : setOpen(true))}
        className="-ml-2.5 -mt-1.5 inline-flex items-center gap-2.5 rounded-[11px] px-2.5 py-1.5 hover:bg-bg"
      >
        <span className="text-[23px] font-bold leading-[1.05] tracking-[-0.015em] text-ink">{metric}</span>
        <span className="flex size-[25px] items-center justify-center rounded-lg bg-tlsf">
          <ChevronDown className={`size-3.5 text-teal transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2.4} />
        </span>
      </button>
      <div className="mt-[11px] text-[11px] font-semibold uppercase leading-none tracking-[0.07em] text-fnt">
        {AN_METRIC.group}
      </div>
      {open && (
        <>
          <button className="fixed inset-0 z-30 cursor-default" aria-label="Close" onClick={close} />
          <div className="absolute left-0 top-[calc(100%+8px)] z-40 flex max-h-[420px] w-[360px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[14px] border border-bd bg-sf shadow-[0_20px_50px_var(--shadow)]">
            <div className="border-b border-bd p-2.5">
              <div className="flex items-center gap-2 rounded-[10px] bg-bg2 px-3 py-2.5">
                <Search className="size-4 flex-none text-fnt" strokeWidth={2.2} />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search metrics…"
                  className="w-full bg-transparent text-[13px] font-medium leading-none text-ink outline-none placeholder:text-fnt"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-1.5">
              {empty ? (
                <div className="px-3.5 py-6 text-center text-[13px] font-medium leading-none text-fnt">
                  No metric matches
                </div>
              ) : (
                groups.map((g) => (
                  <div key={g.group} className="pb-1">
                    <div className="px-3.5 pb-1 pt-2 text-[10px] font-bold uppercase leading-none tracking-[0.08em] text-fnt">
                      {g.group}
                    </div>
                    {g.metrics.map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          onSelect(m);
                          close();
                        }}
                        className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13px] font-semibold leading-none hover:bg-bg2 ${
                          m === metric ? "text-teal" : "text-ink"
                        }`}
                      >
                        {m}
                        {m === metric && <Check className="size-4 text-teal" strokeWidth={2.4} />}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
