import Link from "next/link";
import { Avatar } from "@/components/shared/avatar";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { LoanDetail } from "../data";

export function LoanDetailView({ l }: { l: LoanDetail }) {
  return (
    <div className="mx-auto max-w-[1280px] p-4 pb-[78px] md:p-[26px] md:pb-[26px]">
      <Link href="/loans" className="mb-4 inline-block text-[13px] font-semibold leading-none text-teal">
        ← All loans
      </Link>

      <div className="mb-[18px] flex flex-wrap items-center gap-3.5">
        <Avatar name={l.member} size={54} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
              {l.member}
            </h1>
            <StatusBadge status={l.badge} label={l.statusLabel} />
          </div>
          <p className="mt-1.5 text-xs font-medium leading-[1.4] text-mut">
            One loan · started {l.start ?? l.closedDate} · term {l.termLabel}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-[26px] font-semibold leading-none text-ink">{l.amount}</div>
          <div className="mt-1.5 text-[11px] font-medium leading-[1.3] text-fnt">pending {l.pending}</div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <StatCard
          label="This loan's rate"
          value={l.rateDisp}
          sub="Fixed at origination"
          accent
          className="[&_.font-mono]:[word-spacing:-0.25em] [&_.font-mono]:tracking-[-0.01em]"
        />
        <StatCard label="Disbursed in" value={String(l.tranches)} sub="tranche(s) by treasurers" />
        <StatCard label="Interest to date" value={l.interestToDate} sub="accruing daily" />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-bd bg-sf">
          <div className="border-b border-hair px-5 py-4 text-sm font-bold leading-none text-ink">
            Disbursement tranches
          </div>
          {l.trancheList.map((t, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-hr2 px-5 py-3.5 last:border-b-0">
              <span className="size-[9px] flex-none rounded-full bg-teal" />
              <div className="flex-1">
                <div className="text-[13px] font-semibold leading-none text-ink">{t.amt}</div>
                <div className="mt-1 text-[11px] font-medium leading-[1.3] text-fnt">
                  paid by {t.by} · {t.date}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-bd bg-sf">
          <div className="border-b border-hair px-5 py-4 text-sm font-bold leading-none text-ink">
            Repayments &amp; interest
          </div>
          <RepayRow label="Principal repaid" value={`${l.pct}%`} cls="text-in" />
          <RepayRow label="Pending principal" value={l.pending ?? "₹0"} />
          <RepayRow label="Interest collected" value={l.interestCollected} last />
        </div>
      </div>
    </div>
  );
}

function RepayRow({ label, value, cls = "text-ink", last = false }: { label: string; value: string; cls?: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-5 py-3.5 ${last ? "" : "border-b border-hr2"}`}>
      <span className="text-[13px] font-medium leading-none text-mut">{label}</span>
      <span className={`font-mono text-[13px] font-semibold leading-none ${cls}`}>{value}</span>
    </div>
  );
}
