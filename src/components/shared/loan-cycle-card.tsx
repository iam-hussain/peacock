import { StatusBadge } from "./status-badge";
import type { LoanCycleDTO } from "@/server/queries/loans";

const BADGE: Record<LoanCycleDTO["status"], "active" | "left" | "settled"> = {
  active: "active",
  overdue: "left",
  closed: "settled",
};

/** One loan cycle, borderless: soft surface, facts as labelled columns, breakdown as a
 * receipt-style sum ending in the interest total. Used on the member page and /loans. */
export function LoanCycleCard({ c }: { c: LoanCycleDTO }) {
  return (
    <div className="rounded-14 bg-sf2 p-4">
      {/* Cycle + status left · principal right */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold leading-none text-ink">Cycle #{c.n}</span>
          <StatusBadge status={BADGE[c.status]} label={c.statusLabel} />
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-bold leading-none text-ink">{c.amt}</div>
          <div className="mt-1.5 text-9 font-semibold uppercase leading-none tracking-5 text-mut">Principal</div>
        </div>
      </div>

      {/* The facts: period · rate · length */}
      <div className="mt-3.5 flex flex-wrap gap-x-7 gap-y-2.5">
        <Fact label="Period" value={<>{c.start} <span className="text-mut">→</span> {c.end}</>} />
        <Fact label="Rate" value={`${c.rate}% / mo`} />
        <Fact label="Length" value={c.days} />
      </div>

      {/* The maths: each part on its own line, total in teal — whitespace does the separating */}
      <div className="mt-3.5 space-y-1.5">
        {c.breakdown.map((b) => (
          <div key={b.label} className="flex items-baseline justify-between gap-2">
            <span className="text-11 font-medium leading-none text-fnt">{b.label}</span>
            <span className="font-mono text-11 font-semibold leading-none text-ink">{b.amt}</span>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-2 pt-1">
          <span className="text-11 font-semibold leading-none text-ink">Interest</span>
          <span className="font-mono text-xs font-bold leading-none text-in">{c.interest}</span>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-9 font-semibold uppercase leading-none tracking-5 text-mut">{label}</div>
      <div className="mt-1.5 text-11 font-semibold leading-none text-ink">{value}</div>
    </div>
  );
}
