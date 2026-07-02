"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { LOAN_FILTERS, type Loan, type LoanStat } from "../data";

export function LoansList({ loans, stats, rate }: { loans: Loan[]; stats: LoanStat[]; rate: string }) {
  const [filter, setFilter] = useState<string>("All");
  const rows = loans.filter((l) => {
    if (filter === "All") return true;
    if (filter === "Active") return l.status === "active";
    if (filter === "Overdue") return l.status === "overdue";
    return l.status === "closed";
  });

  return (
    <div className="mx-auto max-w-[1280px] p-4 pb-[78px] md:p-[26px] md:pb-[26px]">
      {/* Title — desktop only (mobile top-bar already shows "Loans") */}
      <div className="mb-4 hidden flex-wrap items-baseline gap-3 md:flex">
        <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">Loans</h1>
        <span className="text-[13px] font-medium leading-none text-fnt">
          Current rate <span className="font-semibold text-teal">{rate}</span>
        </span>
      </div>

      {/* KPIs — desktop: full tiles with sub */}
      <div className="mb-4 hidden grid-cols-4 gap-3.5 md:grid">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} tone={s.tone ?? "ink"} />
        ))}
      </div>

      {/* KPIs — mobile: compact, no sub, overdue count inline */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 md:hidden">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} inlineNote={s.count} tone={s.tone ?? "ink"} compact />
        ))}
      </div>

      {/* Desktop: single card with rows */}
      <div className="hidden overflow-hidden rounded-2xl border border-bd bg-sf shadow-[0_1px_2px_var(--shadow)] md:block">
        <Filters filter={filter} onChange={setFilter} className="border-b border-hair px-[18px] py-3.5" />
        {rows.map((l) => (
          <LoanRowDesktop key={l.id} l={l} />
        ))}
        {rows.length === 0 && <Empty />}
      </div>

      {/* Mobile: filter chips + separate loan cards */}
      <div className="md:hidden">
        <Filters filter={filter} onChange={setFilter} className="pb-1" />
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
    </div>
  );
}

function Filters({ filter, onChange, className = "" }: { filter: string; onChange: (f: string) => void; className?: string }) {
  return (
    <div className={`flex gap-2 overflow-x-auto ${className}`}>
      {LOAN_FILTERS.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`whitespace-nowrap rounded-[8px] border px-3.5 py-2 text-[12px] font-semibold leading-none transition-colors ${
            filter === f ? "border-teal/40 bg-tlsf text-teal" : "border-bd2 bg-sf text-mut"
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="px-[18px] py-10 text-center">
      <div className="mb-1.5 text-sm font-bold leading-none text-ink">No loans here</div>
      <div className="text-xs font-medium leading-[1.4] text-fnt">No loans match this filter.</div>
    </div>
  );
}

/** Mobile: each loan is its own card — identity + amount/status, no progress bar. */
function MobileLoanCard({ l }: { l: Loan }) {
  return (
    <Link href={`/loans/${l.id}`} className="block rounded-2xl border border-bd bg-sf px-4 py-[15px] active:bg-sf2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <Avatar name={l.member} size={38} muted />
          <div className="min-w-0">
            <div className="flex items-center gap-[7px]">
              <span className="text-[15px] font-semibold leading-none text-ink">{l.member}</span>
              {l.tranches && l.tranches > 1 && (
                <span className="rounded-[5px] bg-bg2 px-1.5 py-[3px] text-[9px] font-semibold leading-none text-mut">
                  {l.tranches} tr
                </span>
              )}
            </div>
            <div className="mt-[7px] text-[11px] font-medium leading-[1.35] text-fnt">
              {l.open ? (
                <>
                  Started {l.start} ·{" "}
                  <span className={`font-semibold ${l.overdue ? "text-out" : "text-mut"}`}>{l.elapsed}</span>
                </>
              ) : (
                <>
                  Closed {l.closedDate} · {l.ran}
                </>
              )}
            </div>
            <div className="mt-1 font-mono text-[11px] font-medium leading-[1.35] text-fnt">
              {l.open ? (
                <>
                  pending {l.pending} · {l.rate}
                </>
              ) : (
                <>
                  interest earned {l.interestEarned}
                  {l.interestDue && (
                    <>
                      {" "}· <span className="text-wfg">due {l.interestDue}</span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-none flex-col items-end gap-2">
          <span className="font-mono text-[15px] font-semibold leading-none text-ink">{l.amount}</span>
          <StatusBadge status={l.badge} label={l.statusLabel} />
        </div>
      </div>
    </Link>
  );
}

/** Desktop row: identity · progress/interest · amount+status. */
function LoanRowDesktop({ l }: { l: Loan }) {
  return (
    <Link
      href={`/loans/${l.id}`}
      className="flex items-center gap-3.5 border-b border-hr2 px-[18px] py-[15px] transition-colors last:border-b-0 hover:bg-sf2"
    >
      <div className="flex flex-[1.4] items-center gap-3.5">
        <Avatar name={l.member} size={34} muted />
        <div className="min-w-0">
          <div className="flex items-center gap-[7px]">
            <span className="text-sm font-semibold leading-none text-ink">{l.member}</span>
            {l.tranches && l.tranches > 1 && (
              <span className="rounded-[5px] bg-bg2 px-1.5 py-[3px] text-[9px] font-semibold leading-none text-mut">
                {l.tranches} tranches
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] font-medium leading-[1.3] text-fnt">
            {l.open ? (
              <>
                Started {l.start} ·{" "}
                <span className={`font-semibold ${l.overdue ? "text-out" : "text-mut"}`}>{l.elapsed}</span>
              </>
            ) : (
              <>
                Closed {l.closedDate} · {l.ran}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-[1.4]">
        {l.open ? (
          <>
            <div className="h-[7px] overflow-hidden rounded-[20px] bg-hair">
              <div className="h-full rounded-[20px] bg-teal" style={{ width: `${l.pct}%` }} />
            </div>
            <div className="mt-1.5 font-mono text-[11px] font-medium leading-[1.3] text-fnt">
              pending {l.pending} · {l.rate}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold leading-none text-in">
              <Check className="size-3" strokeWidth={3} /> Repaid in full
            </div>
            <div className="mt-1.5 font-mono text-[11px] font-medium leading-[1.3] text-fnt">
              interest earned {l.interestEarned}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="w-24 text-right font-mono text-sm font-semibold leading-none text-ink">{l.amount}</span>
        <StatusBadge status={l.badge} label={l.statusLabel} />
      </div>
    </Link>
  );
}
