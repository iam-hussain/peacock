"use client";

import { useState } from "react";
import { StatCard } from "@/components/shared/stat-card";
import { useInPoster } from "@/lib/poster";
import { type Loan, type LoanStat, type LoanEligibility } from "../data";
import { Filters } from "./loan-filters";
import { EligibilityPanel } from "./eligibility-panel";
import { LoanRowDesktop, MobileLoanCard } from "./loan-row";

export function LoansList({ loans, stats, rate, eligibility }: { loans: Loan[]; stats: LoanStat[]; rate: string; eligibility: LoanEligibility[] }) {
  const [filter, setFilter] = useState<string>("Pending");
  const [showClosedMembers, setShowClosedMembers] = useState(false);
  const inPoster = useInPoster();
  // In the poster the rows are pre-filtered by the share toggles and there's no filter UI, so show all.
  const rows = inPoster ? loans : loans.filter((l) => {
    if (!showClosedMembers && l.memberClosed) return false;
    if (filter === "All") return true;
    if (filter === "Pending") return l.pendingInterest;
    if (filter === "Active") return l.status === "active" || l.status === "overdue"; // overdue is active, past term
    return l.status === "closed";
  });

  return (
    <div className="mx-auto max-w-320 p-4 pb-19.5 md:p-6.5 md:pb-6.5">
      {/* Title — desktop only (forced in the poster regardless of viewport) */}
      <div className={`mb-4 flex-wrap items-baseline gap-3 ${inPoster ? "flex" : "hidden md:flex"}`}>
        <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">Loans</h1>
        <span className="text-13 font-medium leading-none text-fnt">
          Current rate <span className="font-semibold text-teal">{rate}</span>
        </span>
      </div>

      {/* KPIs — desktop: full tiles with sub (forced in the poster) */}
      <div className={`mb-4 grid-cols-4 gap-3.5 ${inPoster ? "grid" : "hidden md:grid"}`}>
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} tone={s.tone ?? "ink"} />
        ))}
      </div>

      {/* KPIs — mobile: compact, no sub, overdue count inline */}
      {!inPoster && (
        <div className="mb-4 grid grid-cols-2 gap-2.5 md:hidden">
          {stats.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} inlineNote={s.count} tone={s.tone ?? "ink"} compact />
          ))}
        </div>
      )}

      {!inPoster && <EligibilityPanel members={eligibility} />}

      {/* Desktop: single card with rows (forced in the poster) */}
      <div className={`overflow-hidden rounded-2xl border border-bd bg-sf shadow-card ${inPoster ? "block" : "hidden md:block"}`}>
        {!inPoster && <Filters filter={filter} onChange={setFilter} showClosedMembers={showClosedMembers} onToggleClosedMembers={() => setShowClosedMembers((v) => !v)} className="border-b border-hair px-4.5 py-3.5" />}
        {rows.map((l) => (
          <LoanRowDesktop key={l.id} l={l} />
        ))}
        {rows.length === 0 && <Empty />}
      </div>

      {/* Mobile: filter chips + separate loan cards */}
      {!inPoster && (
      <div className="md:hidden">
        <Filters filter={filter} onChange={setFilter} showClosedMembers={showClosedMembers} onToggleClosedMembers={() => setShowClosedMembers((v) => !v)} className="pb-1" />
        <div className="mt-3 flex flex-col gap-3">
          {rows.map((l) => (
            <MobileLoanCard key={l.id} l={l} />
          ))}
          {rows.length === 0 && (
            <div className="rounded-2xl border border-bd bg-sf px-4 py-10">
              <Empty />
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="px-4.5 py-10 text-center">
      <div className="mb-1.5 text-sm font-bold leading-none text-ink">No loans here</div>
      <div className="text-xs font-medium leading-140 text-fnt">No loans match this filter.</div>
    </div>
  );
}
