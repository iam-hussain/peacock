import Link from "next/link";
import { UserPen, CreditCard } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { FormModalButton } from "@/components/shared/form-modal-button";
import { initials } from "@/lib/avatar";
import type { MemberDetailDTO as MemberDetail } from "@/server/queries/members";

function EditMemberButton({ m }: { m: MemberDetail }) {
  return (
    <FormModalButton
      title="Edit member details"
      subtitle={m.name}
      kind="editMember"
      submitLabel="Save changes"
      hiddenFields={{ id: m.id }}
      fields={[
        { name: "name", label: "Full name", defaultValue: m.name, required: true },
        { name: "phone", label: "Phone", type: "tel", placeholder: "+91 …" },
        { name: "email", label: "Email", type: "email", placeholder: "optional" },
        { name: "username", label: "Username" },
      ]}
      buttonClassName="flex items-center justify-center gap-2 rounded-[11px] border border-bd2 bg-sf p-[13px] text-[13px] font-semibold leading-none text-ink hover:bg-sf2"
    >
      <UserPen className="size-[15px]" strokeWidth={2} /> Edit member details
    </FormModalButton>
  );
}

function TealAvatar({ name, size }: { name: string; size: number }) {
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full border-[3px] border-sf bg-teal font-bold text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {initials(name)}
    </div>
  );
}

export function MemberDetailView({ m }: { m: MemberDetail }) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-[1280px] p-[26px]">
          <Link href="/members" className="mb-4 inline-block text-[13px] font-semibold leading-none text-teal">
            ← All members
          </Link>
          <div className="grid grid-cols-[330px_1fr] items-start gap-[18px]">
            {/* left rail */}
            <div className="sticky top-[26px] flex flex-col gap-3.5">
              <IdentityCard m={m} />
              <BalancesCard m={m} />
              <div className="flex flex-col gap-[9px]">
                <EditMemberButton m={m} />
              </div>
            </div>
            {/* right */}
            <div className="flex flex-col gap-4">
              <ContributionCard m={m} />
              <LedgerCard m={m} />
              <LoansCard m={m} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="pb-[78px] md:hidden">
        <div className="flex flex-col gap-3 p-4">
          <Link href="/members" className="text-[13px] font-semibold leading-none text-teal">
            ← All members
          </Link>
          <IdentityCard m={m} />
          <EditMemberButton m={m} />
          <BalancesCard m={m} />
          <ContributionCard m={m} />
          <LedgerCard m={m} />
          <LoansCard m={m} />
        </div>
      </div>
    </>
  );
}

function IdentityCard({ m }: { m: MemberDetail }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-bd bg-sf shadow-[0_1px_2px_var(--shadow)]">
      <div className="h-[58px] bg-tlsf" />
      <div className="px-5 pb-5">
        <div className="-mt-8">
          <TealAvatar name={m.name} size={64} />
        </div>
        <div className="mt-[13px] flex items-center gap-2.5">
          <h1 className="font-display text-[21px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
            {m.name}
          </h1>
          <StatusBadge status={m.status} />
        </div>
        <p className="mt-[9px] text-xs font-medium leading-[1.45] text-mut">
          Joined {m.joined} · {m.tenure} in the club
        </p>
        <div className="mt-1.5 flex items-center gap-[7px] text-xs font-medium leading-[1.4] text-fnt">
          <CreditCard className="size-[13px]" strokeWidth={2} />
          {m.managing ? `Managing ${m.managing} of club funds` : "Holds no club funds"}
        </div>
      </div>
    </div>
  );
}

function BalancesCard({ m }: { m: MemberDetail }) {
  const rows = [
    { l: "Pending dues", v: m.pending ?? "₹0", cls: m.pending ? "text-outfg" : "text-ink" },
    { l: "Loan taken", v: m.loanTaken, cls: "text-ink" },
    { l: "Interest due", v: m.interestDue, cls: m.interestDue !== "₹0" ? "text-wfg" : "text-ink" },
  ];
  return (
    <div className="rounded-[18px] border border-bd bg-sf px-5 pb-3.5 shadow-[0_1px_2px_var(--shadow)]">
      <div className="pb-1 pt-3.5 text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-fnt">
        Balances
      </div>
      {rows.map((r) => (
        <div key={r.l} className="flex items-center justify-between border-t border-hr2 py-[13px]">
          <span className="text-[13px] font-medium leading-none text-mut">{r.l}</span>
          <span className={`font-mono text-[17px] font-bold leading-none ${r.cls}`}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}

function CardShell({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-bd bg-sf shadow-[0_1px_2px_var(--shadow)]">
      <div className="flex items-baseline justify-between px-[22px] pt-[18px]">
        <h2 className="text-base font-bold leading-none text-ink">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function ContributionCard({ m }: { m: MemberDetail }) {
  return (
    <CardShell title="Contribution & deposits" right={<span className="text-xs font-medium leading-none text-fnt">over {m.tenure}</span>}>
      <div className="my-4 grid grid-cols-2">
        <div className="border-r border-hr2 px-[22px]">
          <div className="text-[10px] font-semibold uppercase leading-none tracking-[0.05em] text-fnt">Member deposits</div>
          <div className="mt-[11px] font-mono text-[28px] font-semibold leading-none text-ink">{m.deposits}</div>
        </div>
        <div className="px-[22px]">
          <div className="text-[10px] font-semibold uppercase leading-none tracking-[0.05em] text-fnt">
            Returns earned <span className="text-teal">· actual</span>
          </div>
          <div className="mt-[11px] font-mono text-[28px] font-semibold leading-none text-in">{m.returnsActual}</div>
          <div className="mt-2 text-[11px] font-medium leading-[1.4] text-fnt">
            Full share if paid in full: <span className="font-semibold text-ink">{m.fullShare}</span> · paid{" "}
            {m.paidRatioPct}%
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 border-t border-hr2">
        <FourCell label="Periodic" value={m.periodic} />
        <FourCell label="Catch-up" value={m.catchup} border />
        <FourCell label="Total" value={m.totalDeposit} border />
        <FourCell label="Pending dues" value={m.pending ?? "₹0"} border accent={!!m.pending} />
      </div>
    </CardShell>
  );
}

function FourCell({ label, value, border = false, accent = false }: { label: string; value: string; border?: boolean; accent?: boolean }) {
  return (
    <div className={`px-[22px] py-[15px] ${border ? "border-l border-hr2" : ""}`}>
      <div className="text-[11px] font-medium leading-none text-mut">{label}</div>
      <div className={`mt-2 font-mono text-sm font-semibold leading-none ${accent ? "text-outfg" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}

function LedgerCard({ m }: { m: MemberDetail }) {
  return (
    <div className="rounded-[18px] border border-bd bg-sf p-[18px] shadow-[0_1px_2px_var(--shadow)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold leading-none text-ink">Catch-up &amp; penalties</h2>
        <button className="flex-none rounded-[9px] border border-bd2 bg-tlsf px-[11px] py-2 text-xs font-semibold leading-none text-teal">
          + Add charge
        </button>
      </div>
      <div className="mb-3.5 flex gap-2">
        <div className="flex-1 rounded-[11px] border border-teal/40 bg-tlsf px-[13px] py-2.5">
          <div className="flex items-center gap-[7px]">
            <span className="size-2 rounded-[3px] bg-teal" />
            <span className="text-xs font-semibold leading-none text-teal">Catch-up</span>
          </div>
          <div className="mt-[9px] font-mono text-[15px] font-semibold leading-none text-ink">
            {m.ledgerRemaining} <span className="font-sans text-[10px] font-medium text-fnt">left</span>
          </div>
        </div>
        <div className="flex-1 rounded-[11px] border border-bd2 bg-sf px-[13px] py-2.5">
          <div className="flex items-center gap-[7px]">
            <span className="size-2 rounded-[3px] bg-wfg" />
            <span className="text-xs font-semibold leading-none text-mut">Penalty</span>
          </div>
          <div className="mt-[9px] font-mono text-[15px] font-semibold leading-none text-ink">
            ₹0 <span className="font-sans text-[10px] font-medium text-fnt">left</span>
          </div>
        </div>
      </div>
      <div className="mb-[11px] flex items-center gap-[18px]">
        <LedgerStat label="Assigned" value={m.ledgerAssigned} />
        <LedgerStat label="Paid" value={m.ledgerPaid} accent />
        <LedgerStat label="Remaining" value={m.ledgerRemaining} />
      </div>
      <div className="mb-[7px] h-1.5 overflow-hidden rounded-md bg-bg2">
        <div className="h-full rounded-md bg-teal" style={{ width: `${m.ledgerPct}%` }} />
      </div>
      <div className="text-[11px] font-medium leading-none text-fnt">{m.ledgerPct}% cleared</div>
    </div>
  );
}

function LedgerStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex-1">
      <div className="text-[10px] font-medium leading-none text-mut">{label}</div>
      <div className={`mt-[7px] font-mono text-[15px] font-semibold leading-none ${accent ? "text-in" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}

function LoansCard({ m }: { m: MemberDetail }) {
  if (!m.hasLoans) {
    return (
      <div className="rounded-[18px] border border-bd bg-sf px-[22px] py-[34px] text-center shadow-[0_1px_2px_var(--shadow)]">
        <div className="mb-1.5 text-[15px] font-bold leading-none text-ink">No loans yet</div>
        <div className="text-[13px] font-medium leading-[1.5] text-fnt">
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
      <div className="mt-[18px] grid grid-cols-3 border-t border-hr2">
        <LoanSmall label="Interest generated" value={m.interestGen} />
        <LoanSmall label="Interest paid" value={m.interestPaid} accent border />
        <LoanSmall label="Interest due" value={m.interestDue} border accent={m.interestDue !== "₹0"} warn />
      </div>
      <div className="border-t border-hr2 px-[22px] pb-5 pt-4">
        <div className="mb-3.5 text-[11px] font-semibold uppercase leading-none tracking-[0.06em] text-fnt">
          Loan history · {m.cycles.length} cycles
        </div>
        <div className="relative pl-[22px]">
          <div className="absolute bottom-2 left-[5px] top-1 w-0.5 bg-hair" />
          {m.cycles.map((c) => (
            <div key={c.n} className="relative pb-[18px] last:pb-0">
              <span className="absolute -left-[22px] top-0.5 size-3 rounded-full border-2 border-sf bg-mut shadow-[0_0_0_1px_var(--hair)]" />
              <div className="rounded-[10px] border border-hair bg-sf2 p-[11px]">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-sm font-bold leading-none text-ink">Loan Cycle #{c.n}</span>
                  <StatusBadge status={c.status === "active" ? "active" : c.status === "overdue" ? "left" : "settled"} label={c.statusLabel} />
                  <span className="flex-1" />
                  <span className="font-mono text-sm font-semibold leading-none text-ink">{c.amt}</span>
                </div>
                <div className="mt-[5px] text-[11px] font-medium leading-[1.4] text-fnt">
                  {c.start} → {c.end} · {c.rate}% · {c.days} · interest{" "}
                  <span className="font-semibold text-in">{c.interest}</span>
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
    <div className={`px-[22px] ${border ? "border-l border-hr2" : ""}`}>
      <div className="text-[10px] font-semibold uppercase leading-none tracking-[0.05em] text-fnt">{label}</div>
      <div className={`mt-[9px] font-mono text-xl font-semibold leading-none ${accent ? "text-in" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}

function LoanSmall({ label, value, accent = false, warn = false, border = false }: { label: string; value: string; accent?: boolean; warn?: boolean; border?: boolean }) {
  return (
    <div className={`px-[22px] py-3.5 ${border ? "border-l border-hr2" : ""}`}>
      <div className="text-[11px] font-medium leading-none text-mut">{label}</div>
      <div className={`mt-2 font-mono text-sm font-semibold leading-none ${warn && accent ? "text-wfg" : accent ? "text-in" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}
