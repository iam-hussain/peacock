import { LoanCycleCard } from "@/components/shared/loan-cycle-card";
import { CardShell } from "./card-shell";
import type { LoanCycleDTO, MemberDetailDTO as MemberDetail } from "@/server/queries/members";

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
        <ul className="relative pl-5.5">
          <span className="absolute bottom-3 left-1.25 top-1.5 w-0.5 rounded-full bg-hair" aria-hidden />
          {m.cycles.map((c) => (
            <LoanCycleItem key={c.n} c={c} />
          ))}
        </ul>
      </div>
    </CardShell>
  );
}

// Status → timeline dot colour (theme tokens only).
const CYCLE_DOT: Record<LoanCycleDTO["status"], string> = {
  active: "bg-teal",
  overdue: "bg-wfg",
  closed: "bg-mut",
};

function LoanCycleItem({ c }: { c: LoanCycleDTO }) {
  return (
    <li className="relative pb-4 last:pb-0">
      <span
        className={`absolute -left-5.5 top-2 size-3 rounded-full border-2 border-sf shadow-[0_0_0_1px_var(--hair)] ${CYCLE_DOT[c.status]}`}
        aria-hidden
      />
      <LoanCycleCard c={c} />
    </li>
  );
}

function LoanStat({ label, value, accent = false, border = false }: { label: string; value: string; accent?: boolean; border?: boolean }) {
  return (
    <div className={`min-w-0 px-3 sm:px-5.5 ${border ? "border-l border-hr2" : ""}`}>
      <div className="truncate text-10 font-semibold uppercase leading-none tracking-5 text-fnt">{label}</div>
      <div className={`mt-2.25 truncate font-mono text-15 font-semibold leading-none sm:text-xl ${accent ? "text-in" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}

function LoanSmall({ label, value, accent = false, warn = false, border = false }: { label: string; value: string; accent?: boolean; warn?: boolean; border?: boolean }) {
  return (
    <div className={`min-w-0 px-3 py-3.5 sm:px-5.5 ${border ? "border-l border-hr2" : ""}`}>
      <div className="truncate text-11 font-medium leading-none text-mut">{label}</div>
      <div className={`mt-2 truncate font-mono text-sm font-semibold leading-none ${warn && accent ? "text-wfg" : accent ? "text-in" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}
