import Link from "next/link";
import { Avatar } from "@/components/shared/avatar";
import { StatusBadge } from "@/components/shared/status-badge";
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

/** Mobile: each loan is its own card — identity + amount/status, no progress bar. */
export function MobileLoanCard({ l }: { l: Loan }) {
  return (
    <Link prefetch={false} href={`/members/${l.memberId}`} className={`block rounded-2xl border px-4 py-3.5 active:bg-sf2 ${l.interestUnpaid ? "border-wfg/40 bg-wbg" : "border-bd bg-sf"}`}>
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

      {/* Footer: stat tiles — all values in one row */}
      <div className="mt-3 flex items-center gap-4 border-t border-hr2 pt-3">
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
      </div>
    </Link>
  );
}

/** Desktop row: identity · progress/interest · amount+status. */
export function LoanRowDesktop({ l }: { l: Loan }) {
  return (
    <Link
      prefetch={false}
      href={`/members/${l.memberId}`}
      className={`flex items-center gap-3.5 border-b border-hr2 px-4.5 py-3.75 transition-colors last:border-b-0 hover:bg-sf2 ${
        l.interestUnpaid ? "bg-wbg" : ""
      }`}
    >
      <div className="flex flex-1 items-center gap-3.5 min-w-0">
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
      </div>

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
      </div>
    </Link>
  );
}
