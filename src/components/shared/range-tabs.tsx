"use client";

import { useState } from "react";

/** Small segmented range switcher (3M / 6M / 1Y …). Visual-only until data is wired. */
export function RangeTabs({
  ranges,
  defaultValue,
  compact = false,
}: {
  ranges: readonly string[];
  defaultValue?: string;
  compact?: boolean;
}) {
  const [active, setActive] = useState(defaultValue ?? ranges[ranges.length - 1]);
  return (
    <div className={`flex rounded-lg bg-bg2 p-[3px] ${compact ? "gap-[3px]" : "gap-1"}`}>
      {ranges.map((r) => (
        <button
          key={r}
          onClick={() => setActive(r)}
          className={`rounded-md font-semibold leading-none transition-colors ${
            compact ? "px-2 py-1.5 text-[10px]" : "px-[9px] py-1.5 text-[11px]"
          } ${active === r ? "bg-sf text-ink shadow-sm" : "text-mut"}`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
