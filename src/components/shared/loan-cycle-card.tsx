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

      {/* Facts left, the maths right (wraps stacked on mobile): parallel labelled columns, interest total in teal */}
      <div className="mt-3.5 flex flex-wrap justify-between gap-x-7 gap-y-2.5">
        {/* Mobile: one tight dot-separated line; sm+: labelled columns */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-2.5 sm:gap-x-7">
          <Fact label="Period" value={<>{c.start} <span className="text-mut">→</span> {c.end}</>} />
          <FactDot />
          <Fact label="Rate" value={`${c.rate}% / mo`} />
          <FactDot />
          <Fact label="Length" value={c.days} />
        </div>
        {/* Mobile: receipt rows (label left, amount right). sm+: right-aligned columns. */}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:gap-x-7 sm:gap-y-2.5">
          {c.breakdown.map((b) => (
            <MathFact key={b.label} label={b.label} amt={b.amt} />
          ))}
          <MathFact label="Interest" amt={c.interest} teal />
        </div>
      </div>
    </div>
  );
}

/** One maths part: a full-width receipt row on mobile, a right-aligned labelled column on sm+. */
function MathFact({ label, amt, teal }: { label: string; amt: string; teal?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-end sm:gap-1.5">
      <span className="text-9 font-semibold uppercase leading-none tracking-5 text-mut">{label}</span>
      <span className={`font-mono text-11 font-semibold leading-none ${teal ? "text-in" : "text-ink"}`}>{amt}</span>
    </div>
  );
}

/** Separator between facts on the single mobile line; gone on sm+ where labels divide them. */
function FactDot() {
  return <span className="text-11 leading-none text-mut sm:hidden">·</span>;
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      {/* Values (dates, rate, length) read on their own — labels only add value on sm+ */}
      <div className="hidden text-9 font-semibold uppercase leading-none tracking-5 text-mut sm:block">{label}</div>
      <div className="text-11 font-semibold leading-none text-ink sm:mt-1.5">{value}</div>
    </div>
  );
}
