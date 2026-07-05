import { StatusBadge } from "@/components/shared/status-badge";
import { CardShell } from "./card-shell";
import type { MemberDetailDTO as MemberDetail } from "@/server/queries/members";

export function LoansCard({ m }: { m: MemberDetail }) {
  if (!m.hasLoans) {
    return (
      <div className="rounded-18 border border-bd bg-sf px-5.5 py-8.5 text-center shadow-card">
        <div className="mb-1.5 text-15 font-bold leading-none text-ink">No loans yet</div>
        <div className="text-13 font-medium leading-150 text-fnt">
          This member hasn&apos;t taken a loan from the club.
        </div>
      </div>
    );
  }
  return (
    <CardShell title="Loans">
      <div className="mt-4 grid grid-cols-3">
        <LoanStat label="Total taken" value={m.loanTaken} />
        <LoanStat label="Repaid" value={m.loanRepaid} accent border />
        <LoanStat label="Current" value={m.currentLoan} border />
      </div>
      <div className="mt-4.5 grid grid-cols-3 border-t border-hr2">
        <LoanSmall label="Interest generated" value={m.interestGen} />
        <LoanSmall label="Interest paid" value={m.interestPaid} accent border />
        <LoanSmall label="Interest due" value={m.interestDue} border accent={m.interestDue !== "₹0"} warn />
      </div>
      <div className="border-t border-hr2 px-5.5 pb-5 pt-4">
        <div className="mb-3.5 text-11 font-semibold uppercase leading-none tracking-6 text-fnt">
          Loan history · {m.cycles.length} cycles
        </div>
        <div className="relative pl-5.5">
          <div className="absolute bottom-2 left-1.25 top-1 w-0.5 bg-hair" />
          {m.cycles.map((c) => (
            <div key={c.n} className="relative pb-4.5 last:pb-0">
              <span className="absolute -left-5.5 top-0.5 size-3 rounded-full border-2 border-sf bg-mut shadow-[0_0_0_1px_var(--hair)]" />
              <div className="rounded-10 border border-hair bg-sf2 p-2.75">
                <div className="flex flex-wrap items-start gap-2.5">
                  <span className="text-sm font-bold leading-none text-ink">Loan Cycle #{c.n}</span>
                  <StatusBadge status={c.status === "active" ? "active" : c.status === "overdue" ? "left" : "settled"} label={c.statusLabel} />
                  <span className="flex-1" />
                  <div className="flex flex-col items-end gap-1.25">
                    <span className="font-mono text-sm font-semibold leading-none text-ink">{c.amt}</span>
                    <span className="font-mono text-11 font-medium leading-none text-fnt">interest <span className="font-semibold text-in">{c.interest}</span></span>
                  </div>
                </div>
                <div className="mt-1.25 text-11 font-medium leading-140 text-fnt">
                  {c.start} → {c.end} · {c.rate}% · {c.days}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  );
}

function LoanStat({ label, value, accent = false, border = false }: { label: string; value: string; accent?: boolean; border?: boolean }) {
  return (
    <div className={`px-5.5 ${border ? "border-l border-hr2" : ""}`}>
      <div className="text-10 font-semibold uppercase leading-none tracking-5 text-fnt">{label}</div>
      <div className={`mt-2.25 font-mono text-xl font-semibold leading-none ${accent ? "text-in" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}

function LoanSmall({ label, value, accent = false, warn = false, border = false }: { label: string; value: string; accent?: boolean; warn?: boolean; border?: boolean }) {
  return (
    <div className={`px-5.5 py-3.5 ${border ? "border-l border-hr2" : ""}`}>
      <div className="text-11 font-medium leading-none text-mut">{label}</div>
      <div className={`mt-2 font-mono text-sm font-semibold leading-none ${warn && accent ? "text-wfg" : accent ? "text-in" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}
