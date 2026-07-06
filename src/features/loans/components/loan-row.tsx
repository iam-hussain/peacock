"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoanCycleCard } from "@/components/shared/loan-cycle-card";
import type { Loan } from "../data";

/** Stacked label + value pair (right-aligned by default), used across the loan rows and cards. */
function AmtCol({ label, value, tone, align = "end", className = "" }: { label: string; value: string; tone: "ink" | "wfg" | "in"; align?: "start" | "end"; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${align === "start" ? "items-start" : "items-end"} ${className}`}>
      <span className="whitespace-nowrap text-9 font-semibold uppercase leading-none tracking-wide text-mut">{label}</span>
      <span className={`font-mono text-sm font-semibold leading-none ${tone === "wfg" ? "text-wfg" : tone === "in" ? "text-in" : "text-ink"}`}>{value}</span>
    </div>
  );
}

/** Chevron that expands the per-cycle interest breakdown under a row/card. */
function ExpandToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={open ? "Hide interest breakdown" : "Show interest breakdown"}
      onClick={onToggle}
      className="flex size-7 shrink-0 items-center justify-center rounded-8 text-mut transition-colors hover:bg-bg2 hover:text-ink"
    >
      <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2} />
    </button>
  );
}

/** The expanded panel: every balance-constant cycle with its interest breakdown. */
function CyclesPanel({ l }: { l: Loan }) {
  return (
    <div className="space-y-2.5 px-4.5 pb-4 pt-1">
      <div className="text-10 font-semibold uppercase leading-none tracking-5 text-fnt">
        Interest breakdown · {l.cycles.length} cycle{l.cycles.length === 1 ? "" : "s"}
      </div>
      {l.cycles.map((c) => (
        <LoanCycleCard key={c.n} c={c} />
      ))}
    </div>
  );
}

/** Mobile: each loan is its own card — identity + amount/status, expandable cycle breakdown. */
export function MobileLoanCard({ l }: { l: Loan }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`overflow-hidden rounded-2xl border ${l.interestUnpaid ? "border-wfg/40 bg-wbg" : "border-bd bg-sf"}`}>
      <Link prefetch={false} href={`/members/${l.memberId}`} className="block px-4 pt-3.5 active:bg-sf2">
        {/* Header: identity + status */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={l.member} src={l.avatar} size={38} muted />
            <div className="min-w-0">
              <div className="flex items-center gap-1.75">
                <span className="truncate text-15 font-semibold leading-none text-ink">{l.member}</span>
                {l.tranches && l.tranches > 1 && (
                  <span className="shrink-0 rounded-5 bg-bg2 px-1.5 py-0.75 text-9 font-semibold leading-none text-mut">
                    {l.tranches} tr
                  </span>
                )}
              </div>
              <div className="mt-1.5 space-y-0.5 text-11 font-medium leading-none text-fnt">
                {l.open ? (
                  <>
                    <div className="truncate">Started {l.start}</div>
                    <div className="truncate">
                      <span className={`font-semibold ${l.overdue ? "text-out" : "text-mut"}`}>{l.elapsed}</span>
                      {l.rate ? <span className="text-mut"> · {l.rate}</span> : null}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="truncate">Closed {l.closedDate}</div>
                    <div className="truncate">{l.ran}</div>
                  </>
                )}
              </div>
            </div>
          </div>
          <StatusBadge status={l.badge} label={l.statusLabel} />
        </div>
      </Link>

      {/* Footer: stat tiles — all values in one row + breakdown toggle */}
      <div className="mx-4 mt-3 flex items-center gap-4 border-t border-hr2 py-3">
        <AmtCol label="Generated" value={l.interestEarned!} tone="ink" align="start" />
        {l.interestCurrent && <AmtCol label="Current" value={l.interestCurrent} tone="ink" align="start" />}
        {l.interestOverpaid ? (
          <AmtCol label="Overpaid" value={l.interestOverpaid} tone="in" align="start" />
        ) : l.open ? (
          <AmtCol label="Pending interest" value={l.interest!} tone="wfg" align="start" />
        ) : l.interestUnpaid ? (
          <AmtCol label="Interest due" value={l.interestDue!} tone="wfg" align="start" />
        ) : null}
        <AmtCol label="Loan" value={l.amount} tone="ink" className="ml-auto" />
        <ExpandToggle open={open} onToggle={() => setOpen((v) => !v)} />
      </div>
      {open && <CyclesPanel l={l} />}
    </div>
  );
}

/** Desktop row: identity · progress/interest · amount+status, expandable cycle breakdown. */
export function LoanRowDesktop({ l }: { l: Loan }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-b border-hr2 last:border-b-0 ${l.interestUnpaid ? "bg-wbg" : ""}`}>
      <div className="flex items-center gap-3.5 px-4.5 py-3.75 transition-colors hover:bg-sf2">
        <Link prefetch={false} href={`/members/${l.memberId}`} className="flex flex-1 items-center gap-3.5 min-w-0">
          <Avatar name={l.member} src={l.avatar} size={34} muted />
          <div className="min-w-0">
            <div className="flex items-center gap-1.75">
              <span className="text-sm font-semibold leading-none text-ink">{l.member}</span>
              {l.tranches && l.tranches > 1 && (
                <span className="rounded-5 bg-bg2 px-1.5 py-0.75 text-9 font-semibold leading-none text-mut">
                  {l.tranches} tranches
                </span>
              )}
            </div>
            <div className="mt-1 text-11 font-medium leading-130 text-fnt">
              {l.open ? (
                <>
                  Started {l.start} ·{" "}
                  <span className={`font-semibold ${l.overdue ? "text-out" : "text-mut"}`}>{l.elapsed}</span>
                  {l.rate ? <span className="text-mut"> · {l.rate}</span> : null}
                </>
              ) : (
                <>
                  Closed {l.closedDate} · {l.ran}
                </>
              )}
            </div>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-8">
          <AmtCol label="Generated" value={l.interestEarned!} tone="ink" className="w-16 shrink-0" />
          {l.interestCurrent ? (
            <AmtCol label="Current" value={l.interestCurrent} tone="ink" className="w-16 shrink-0" />
          ) : (
            <div className="w-16 shrink-0" />
          )}
          {l.interestOverpaid ? (
            <AmtCol label="Overpaid" value={l.interestOverpaid} tone="in" className="w-28 shrink-0" />
          ) : l.open ? (
            <AmtCol label="Pending interest" value={l.interest!} tone="wfg" className="w-28 shrink-0" />
          ) : l.interestUnpaid ? (
            <AmtCol label="Interest due" value={l.interestDue!} tone="wfg" className="w-28 shrink-0" />
          ) : (
            <div className="w-28 shrink-0" />
          )}
          <AmtCol label="Loan" value={l.amount} tone="ink" className="w-14 shrink-0" />
          <div className="flex w-24 shrink-0 justify-end">
            <StatusBadge status={l.badge} label={l.statusLabel} />
          </div>
          <ExpandToggle open={open} onToggle={() => setOpen((v) => !v)} />
        </div>
      </div>
      {open && <CyclesPanel l={l} />}
    </div>
  );
}
