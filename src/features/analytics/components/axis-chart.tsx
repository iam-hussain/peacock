"use client";

import { useState } from "react";

export function AxisChart({ data, labels, unit, rotated = false }: { data: number[]; labels: string[]; unit: "money" | "count"; rotated?: boolean }) {
  const W = 1000;
  const H = 280;
  // money points are ₹ lakhs; counts are raw. Format axis + tooltip to match.
  const fmt = (v: number) => (unit === "money" ? `₹${v.toFixed(v < 10 ? 1 : 0)}L` : Math.round(v).toString());
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const n = data.length;
  const pts = data.map((v, i) => [(i / (n - 1)) * W, H - ((v - min) / range) * H] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const yTicks = [0, 1, 2, 3].map((i) => {
    const val = max - (range / 3) * i;
    return { topPct: (i / 3) * 100, label: fmt(val) };
  });
  const step = Math.ceil(labels.length / 6);
  const xTicks = labels
    .map((m, i) => ({ m, i }))
    .filter(({ i }) => i % step === 0)
    .map(({ m, i }) => ({ label: m, leftPct: (i / (labels.length - 1)) * 100 }));

  const [hover, setHover] = useState<number | null>(null);

  // In the rotated (portrait-fullscreen) chart the time axis runs top→bottom on screen, so scrub the
  // pointer's Y against the box height; otherwise the usual left→right against width.
  function pick(clientX: number, clientY: number, rect: DOMRect) {
    const ratio = rotated ? (clientY - rect.top) / rect.height : (clientX - rect.left) / rect.width;
    setHover(Math.round(Math.min(1, Math.max(0, ratio)) * (n - 1)));
  }

  const hx = hover != null ? (hover / (n - 1)) * 100 : 0;
  const hy = hover != null ? (pts[hover][1] / H) * 100 : 0;

  return (
    <div>
      <div className="flex gap-2.5">
        <div className="relative h-75 w-13 flex-none">
          {yTicks.map((t, i) => (
            <div
              key={i}
              className="absolute right-0 w-full -translate-y-1/2 text-right font-mono text-11 font-medium leading-none text-fnt"
              style={{ top: `${t.topPct}%` }}
            >
              {t.label}
            </div>
          ))}
        </div>
        <div
          className="relative h-75 flex-1 touch-none"
          onMouseMove={(e) => pick(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => pick(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget.getBoundingClientRect())}
          onTouchMove={(e) => pick(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget.getBoundingClientRect())}
          onTouchEnd={() => setHover(null)}
        >
          {yTicks.map((t, i) => (
            <div key={i} className="absolute inset-x-0 h-px bg-hr2" style={{ top: `${t.topPct}%` }} />
          ))}
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 block overflow-visible"
          >
            <defs>
              <linearGradient id="anGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="var(--teal)" stopOpacity="0.2" />
                <stop offset="1" stopColor="var(--teal)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#anGrad)" />
            <path d={line} fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>

          {hover != null && (
            <>
              {/* crosshair */}
              <div className="pointer-events-none absolute inset-y-0 w-px bg-bd2" style={{ left: `${hx}%` }} />
              {/* point */}
              <div
                className="pointer-events-none absolute size-2.75 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-teal bg-sf"
                style={{ left: `${hx}%`, top: `${hy}%` }}
              />
              {/* tooltip */}
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 shadow-[0_8px_20px_var(--shadow)]"
                style={{ left: `${hx}%`, top: `calc(${hy}% - 12px)` }}
              >
                <div className="text-10 font-semibold leading-none text-sf/70">{labels[hover]}</div>
                <div className="mt-1 font-mono text-13 font-semibold leading-none text-sf">
                  {fmt(data[hover])}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="mt-2 flex gap-2.5">
        <div className="w-13 flex-none" />
        <div className="relative h-3.5 flex-1">
          {xTicks.map((t, i) => (
            <div
              key={i}
              className="absolute -translate-x-1/2 whitespace-nowrap text-11 font-medium leading-none text-fnt"
              style={{ left: `${t.leftPct}%` }}
            >
              {t.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
