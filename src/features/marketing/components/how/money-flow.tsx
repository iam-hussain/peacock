import { Users, HandCoins, Building2, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* The animated "where money flows" hub-and-spoke diagram — the club's pooled cash
   at the centre, with four counterparties around it. Each spoke carries two pipes:
   a green one for money flowing IN to the pool and a red one for money flowing OUT
   (matching the app's dashboard convention). Pipes are animated dashes; the hub
   gently breathes. Pure CSS — no JS — and fully calm under prefers-reduced-motion. */

type Node = {
  key: string;
  icon: LucideIcon;
  label: string;
  inLabel: string;
  outLabel: string;
  /** node centre, in the 0–100 square coordinate space shared with the SVG */
  x: number;
  y: number;
  /** where the label block sits relative to the node chip */
  place: "top" | "left" | "right" | "bottom";
};

const NODES: Node[] = [
  { key: "members", icon: Users, label: "Members", inLabel: "Deposits", outLabel: "Settlements", x: 50, y: 13, place: "top" },
  { key: "loans", icon: HandCoins, label: "Loans", inLabel: "Repay + interest", outLabel: "Loan out", x: 12, y: 50, place: "left" },
  { key: "vendors", icon: Building2, label: "Vendors", inLabel: "Returns + profit", outLabel: "Invest", x: 88, y: 50, place: "right" },
  { key: "chit", icon: Layers, label: "Chit fund", inLabel: "Payout", outLabel: "Installments", x: 50, y: 87, place: "bottom" },
];

const HUB = { x: 50, y: 50 };
// perpendicular offset (in coord units) that separates the paired in/out pipes
const SEP = 3;

function pipes(n: Node) {
  const vertical = n.x === HUB.x;
  // "in" pipe (green, flows node → hub) and "out" pipe (red, flows hub → node),
  // nudged to opposite sides of the spoke so both read clearly.
  if (vertical) {
    return {
      inPipe: { x1: HUB.x - SEP, y1: HUB.y, x2: n.x - SEP, y2: n.y },
      outPipe: { x1: HUB.x + SEP, y1: HUB.y, x2: n.x + SEP, y2: n.y },
    };
  }
  return {
    inPipe: { x1: HUB.x, y1: HUB.y - SEP, x2: n.x, y2: n.y - SEP },
    outPipe: { x1: HUB.x, y1: HUB.y + SEP, x2: n.x, y2: n.y + SEP },
  };
}

export function MoneyFlow() {
  return (
    <div className="rounded-2xl border border-hair bg-gradient-to-b from-sf to-sf2 p-4 md:p-6">
      <div className="relative mx-auto aspect-square w-full max-w-[300px] sm:max-w-[360px] md:max-w-[420px]">
        {/* pipes */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 size-full"
          fill="none"
          aria-hidden
        >
          {NODES.map((n) => {
            const { inPipe, outPipe } = pipes(n);
            return (
              <g key={n.key}>
                {/* faint base rails */}
                <line {...inPipe} stroke="var(--hair)" strokeWidth={3} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                <line {...outPipe} stroke="var(--hair)" strokeWidth={3} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                {/* animated flow: green in (node→hub), red out (hub→node) */}
                <line
                  x1={inPipe.x2}
                  y1={inPipe.y2}
                  x2={inPipe.x1}
                  y2={inPipe.y1}
                  stroke="var(--in)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className="hiw-pipe"
                />
                <line
                  {...outPipe}
                  stroke="var(--out)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className="hiw-pipe"
                />
              </g>
            );
          })}
        </svg>

        {/* nodes */}
        {NODES.map((n) => (
          <NodeChip key={n.key} node={n} />
        ))}

        {/* hub */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${HUB.x}%`, top: `${HUB.y}%` }}
        >
          <span className="hiw-ring absolute inset-0 -z-10 rounded-full bg-teal/25" aria-hidden />
          <div className="hiw-hub flex size-22 flex-col items-center justify-center rounded-full bg-teal text-center shadow-pop md:size-26">
            <span className="text-9 font-semibold uppercase leading-none tracking-6 text-teal-ink md:text-10">
              Club pool
            </span>
            <span className="mt-1 px-1 text-10 font-bold leading-110 text-white md:mt-1.25 md:text-11">
              Treasurers hold the cash
            </span>
          </div>
        </div>
      </div>

      {/* legend */}
      <div className="mt-4 flex items-center justify-center gap-5 md:mt-5">
        <LegendDot tone="in" label="Money in to the pool" />
        <LegendDot tone="out" label="Money out of the pool" />
      </div>
    </div>
  );
}

function NodeChip({ node }: { node: Node }) {
  const { icon: Icon, label, inLabel, outLabel, place } = node;
  // Push the label block to the node's OUTER side so it clears the converging pipes;
  // a translucent surface pill masks whatever pipe passes behind it.
  const wrap = place === "top" ? "flex-col-reverse items-center" : "flex-col items-center";
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
    >
      <div className={cn("flex gap-1.5", wrap)}>
        <div className="flex size-11 flex-none items-center justify-center rounded-14 border border-bd bg-sf shadow-card md:size-13">
          <Icon className="size-5 text-ink md:size-5.5" strokeWidth={2} />
        </div>
        <div className="rounded-8 bg-sf/85 px-1.5 py-0.5 text-center backdrop-blur-[2px]">
          <div className="text-11 font-bold leading-none text-ink md:text-12">{label}</div>
          <div className="mt-1 flex flex-col items-center gap-0.5">
            <span className="whitespace-nowrap text-9 font-semibold leading-none text-in md:text-10">
              ↑ {inLabel}
            </span>
            <span className="whitespace-nowrap text-9 font-semibold leading-none text-out md:text-10">
              ↓ {outLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendDot({ tone, label }: { tone: "in" | "out"; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-2.5 rounded-full", tone === "in" ? "bg-in" : "bg-out")} />
      <span className="text-11 font-medium leading-none text-mut md:text-xs">{label}</span>
    </div>
  );
}
