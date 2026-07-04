"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Modal } from "@/components/shared/modal";
import { useInPoster } from "@/lib/poster";
import { LOAN_FILTERS, type Loan, type LoanStat, type LoanEligibility, type LoanPriority } from "../data";

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
    <div className="mx-auto max-w-[1280px] p-4 pb-[78px] md:p-[26px] md:pb-[26px]">
      {/* Title — desktop only (forced in the poster regardless of viewport) */}
      <div className={`mb-4 flex-wrap items-baseline gap-3 ${inPoster ? "flex" : "hidden md:flex"}`}>
        <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">Loans</h1>
        <span className="text-[13px] font-medium leading-none text-fnt">
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
      <div className={`overflow-hidden rounded-2xl border border-bd bg-sf shadow-[0_1px_2px_var(--shadow)] ${inPoster ? "block" : "hidden md:block"}`}>
        {!inPoster && <Filters filter={filter} onChange={setFilter} showClosedMembers={showClosedMembers} onToggleClosedMembers={() => setShowClosedMembers((v) => !v)} className="border-b border-hair px-[18px] py-3.5" />}
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

const PRIORITY_CHIP: Record<LoanPriority, string> = {
  High: "text-teal",
  Medium: "text-mut",
  Low: "text-fnt",
};

/** "Who can borrow next" — a compact bar (title + eligible count); "View" opens the full list in
 * a modal with each member's next-loan eligibility + priority hint (PRODUCT.md §8). */
function EligibilityPanel({ members }: { members: LoanEligibility[] }) {
  const [open, setOpen] = useState(false);
  if (members.length === 0) return null;
  const eligibleCount = members.filter((m) => m.eligible).length;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-bd bg-sf px-[18px] py-3.5 shadow-[0_1px_2px_var(--shadow)]">
      <span className="text-[13px] font-bold leading-none text-ink">Who can borrow next</span>
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-medium leading-none text-fnt">{eligibleCount} eligible · priority is a hint</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-[8px] border border-bd2 bg-sf px-3.5 py-2 text-[12px] font-semibold leading-none text-teal hover:bg-sf2"
        >
          View
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Who can borrow next" subtitle="Priority is a hint — the admin decides who actually borrows.">
        <div className="flex flex-col">
          {members.map((m) => (
            <Link
              key={m.memberId}
              href={`/members/${m.memberId}`}
              className="flex items-center gap-2.5 border-b border-hr2 py-2.5 leading-none last:border-b-0 hover:opacity-70"
            >
              <span className={`size-[8px] flex-none rounded-full ${m.eligible ? "bg-teal" : "bg-bd2"}`} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{m.member}</span>
              <span className={`flex-none text-[9px] font-bold uppercase tracking-[0.04em] ${PRIORITY_CHIP[m.priority]}`}>{m.priority}</span>
              <span className={`flex-none whitespace-nowrap text-right text-[11px] font-medium ${m.eligible ? "text-teal" : "text-fnt"}`}>
                {m.eligible ? "Eligible" : m.reason}
              </span>
            </Link>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function Filters({
  filter,
  onChange,
  showClosedMembers,
  onToggleClosedMembers,
  className = "",
}: {
  filter: string;
  onChange: (f: string) => void;
  showClosedMembers: boolean;
  onToggleClosedMembers: () => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 overflow-x-auto ${className}`}>
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
      <button
        onClick={onToggleClosedMembers}
        aria-pressed={showClosedMembers}
        className={`ml-auto flex items-center gap-1.5 whitespace-nowrap rounded-[8px] border px-3.5 py-2 text-[12px] font-semibold leading-none transition-colors ${
          showClosedMembers ? "border-teal/40 bg-tlsf text-teal" : "border-bd2 bg-sf text-mut"
        }`}
      >
        {showClosedMembers ? <Eye className="size-3.5" strokeWidth={2.5} /> : <EyeOff className="size-3.5" strokeWidth={2.5} />}
        Closed members
      </button>
    </div>
  );
}

/** Right-aligned label + value pair, used for the loan amount and pending interest. */
function AmtCol({ label, value, tone, className = "" }: { label: string; value: string; tone: "ink" | "wfg" | "in"; className?: string }) {
  return (
    <div className={`flex flex-col items-end gap-1.5 ${className}`}>
      <span className="text-[9px] font-semibold uppercase leading-none tracking-wide text-mut">{label}</span>
      <span className={`font-mono text-sm font-semibold leading-none ${tone === "wfg" ? "text-wfg" : tone === "in" ? "text-in" : "text-ink"}`}>{value}</span>
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
    <Link href={`/members/${l.memberId}`} className={`block rounded-2xl border px-4 py-[15px] active:bg-sf2 ${l.interestUnpaid ? "border-wfg/40 bg-wbg" : "border-bd bg-sf"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <Avatar name={l.member} src={l.avatar} size={38} muted />
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
                  <div>Started {l.start}</div>
                  <div className={`font-semibold ${l.overdue ? "text-out" : "text-mut"}`}>{l.elapsed}</div>
                </>
              ) : (
                <>
                  <div>Closed {l.closedDate}</div>
                  <div>{l.ran}</div>
                </>
              )}
            </div>
            <div className="mt-1 font-mono text-[11px] font-medium leading-[1.35] text-fnt">
              {l.open ? (
                <>{l.rate}</>
              ) : (
                <>interest earned {l.interestEarned}</>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-none flex-col items-end gap-2.5">
          <div className="flex items-start gap-5">
            {l.interestOverpaid ? (
              <AmtCol label="Overpaid" value={l.interestOverpaid} tone="in" />
            ) : l.open ? (
              <AmtCol label="Pending interest" value={l.interest!} tone="wfg" />
            ) : l.interestUnpaid ? (
              <AmtCol label="Interest due" value={l.interestDue!} tone="wfg" />
            ) : null}
            <AmtCol label="Loan" value={l.amount} tone="ink" />
          </div>
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
      href={`/members/${l.memberId}`}
      className={`flex items-center gap-3.5 border-b border-hr2 px-[18px] py-[15px] transition-colors last:border-b-0 hover:bg-sf2 ${
        l.interestUnpaid ? "bg-wbg" : ""
      }`}
    >
      <div className="flex flex-[1.4] items-center gap-3.5">
        <Avatar name={l.member} src={l.avatar} size={34} muted />
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

      <div className="flex-[0.9]">
        <div className="font-mono text-[11px] font-medium leading-[1.3] text-fnt">
          <div>interest earned {l.interestEarned}</div>
          {l.interestCurrent && <div>current {l.interestCurrent}</div>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-5">
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
      </div>
    </Link>
  );
}
