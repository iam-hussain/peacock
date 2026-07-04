import Link from "next/link";
import { Avatar } from "@/components/shared/avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Loan } from "../data";

/** Right-aligned label + value pair, used for the loan amount and pending interest. */
function AmtCol({ label, value, tone, className = "" }: { label: string; value: string; tone: "ink" | "wfg" | "in"; className?: string }) {
  return (
    <div className={`flex flex-col items-end gap-1.5 ${className}`}>
      <span className="text-9 font-semibold uppercase leading-none tracking-wide text-mut">{label}</span>
      <span className={`font-mono text-sm font-semibold leading-none ${tone === "wfg" ? "text-wfg" : tone === "in" ? "text-in" : "text-ink"}`}>{value}</span>
    </div>
  );
}

/** Mobile: each loan is its own card — identity + amount/status, no progress bar. */
export function MobileLoanCard({ l }: { l: Loan }) {
  return (
    <Link href={`/members/${l.memberId}`} className={`block rounded-2xl border px-4 py-3.75 active:bg-sf2 ${l.interestUnpaid ? "border-wfg/40 bg-wbg" : "border-bd bg-sf"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <Avatar name={l.member} src={l.avatar} size={38} muted />
          <div className="min-w-0">
            <div className="flex items-center gap-1.75">
              <span className="text-15 font-semibold leading-none text-ink">{l.member}</span>
              {l.tranches && l.tranches > 1 && (
                <span className="rounded-5 bg-bg2 px-1.5 py-0.75 text-9 font-semibold leading-none text-mut">
                  {l.tranches} tr
                </span>
              )}
            </div>
            <div className="mt-1.75 text-11 font-medium leading-135 text-fnt">
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
            <div className="mt-1 font-mono text-11 font-medium leading-135 text-fnt">
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
export function LoanRowDesktop({ l }: { l: Loan }) {
  return (
    <Link
      href={`/members/${l.memberId}`}
      className={`flex items-center gap-3.5 border-b border-hr2 px-4.5 py-3.75 transition-colors last:border-b-0 hover:bg-sf2 ${
        l.interestUnpaid ? "bg-wbg" : ""
      }`}
    >
      <div className="flex flex-[1.4] items-center gap-3.5">
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
        <div className="font-mono text-11 font-medium leading-130 text-fnt">
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
