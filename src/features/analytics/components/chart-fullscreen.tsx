"use client";

import { useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { AxisChart } from "./axis-chart";

// Mobile-only "view bigger" for the chart. Phones are held portrait but a time series reads best
// wide, so the overlay is CSS-rotated to landscape (dvh/dvw + rotate-90) — no Fullscreen/Orientation
// API, which is unsupported on iOS Safari. Stays interactive: AxisChart's `rotated` scrubs the
// pointer's Y (the on-screen time axis) so hover/tooltip work through the rotation.
export function ChartFullscreen({
  data,
  labels,
  unit,
  title,
  value,
}: {
  data: number[];
  labels: string[];
  unit: "money" | "count";
  title: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="View chart fullscreen"
        className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-lg border border-bd2 bg-sf text-mut shadow-card active:bg-sf2 md:hidden"
      >
        <Maximize2 className="size-4" strokeWidth={2.2} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-bg">
          <button
            onClick={() => setOpen(false)}
            aria-label="Close fullscreen"
            className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full border border-bd2 bg-sf text-ink shadow-card active:bg-sf2"
          >
            <X className="size-5" strokeWidth={2.2} />
          </button>

          {/* landscape box: width=100dvh, height=100dvw, rotated 90° → fills a portrait screen sideways */}
          <div
            className="absolute left-1/2 top-1/2 flex origin-center -translate-x-1/2 -translate-y-1/2 rotate-90 flex-col p-6"
            style={{ width: "100dvh", height: "100dvw" }}
          >
            <div className="mb-1 text-13 font-semibold leading-none text-mut">{title}</div>
            <div className="mb-4 font-mono text-3xl font-semibold leading-none tracking-[-0.01em] text-ink">{value}</div>
            <div className="min-h-0 flex-1">
              <AxisChart data={data} labels={labels} unit={unit} rotated />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
