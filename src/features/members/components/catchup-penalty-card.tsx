"use client";

import { useState } from "react";
import { Check, Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { FormModalButton } from "@/components/shared/form-modal-button";
import { AdminOnly } from "@/lib/admin";
import { AddChargeDialog, RecordPaymentDialog, DeleteEntryDialog } from "./catchup-penalty-modals";
import type { MemberDetailDTO as MemberDetail, LedgerEntryDTO, ChargeSuggest } from "@/server/queries/members";

type Bucket = "catchup" | "penalty";

/** Catch-up & penalties ledger: tabbed buckets, entries list, add/edit charge, record/edit payment. */
export function CatchupPenaltyCard({ m }: { m: MemberDetail }) {
  const [tab, setTab] = useState<Bucket>("catchup");
  const B = {
    catchup: {
      subtitle: "Join-time equalisation · counts as the member's own contribution.",
      bar: "bg-teal", amt: "text-teal", chargeIcon: "bg-tlsf text-teal",
      entries: m.catchupEntries, assigned: m.ledgerAssigned, paid: m.ledgerPaid, remaining: m.ledgerRemaining, pct: m.ledgerPct,
      suggest: m.catchupSuggest, remainingRupees: m.ledgerRemainingRupees,
    },
    penalty: {
      subtitle: "Delayed-payment penalty · club income, shared back as profit.",
      bar: "bg-wfg", amt: "text-wfg", chargeIcon: "bg-wbg text-wfg",
      entries: m.penaltyEntries, assigned: m.penaltyAssigned, paid: m.penaltyPaid, remaining: m.penaltyRemaining, pct: m.penaltyPct,
      suggest: m.penaltySuggest, remainingRupees: m.penaltyRemainingRupees,
    },
  };
  const cur = B[tab];
  const hidden = { membershipId: m.membershipId, memberId: m.id };

  return (
    <div className="overflow-hidden rounded-[18px] border border-bd bg-sf shadow-[0_1px_2px_var(--shadow)]">
      <div className="p-[18px]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold leading-none text-ink">Catch-up &amp; penalties</h2>
          <AdminOnly>
            <AddChargeDialog
              bucket={tab}
              memberName={m.name}
              hidden={hidden}
              suggest={cur.suggest}
              className="flex-none rounded-[9px] border border-bd2 bg-tlsf px-[11px] py-2 text-xs font-semibold leading-none text-teal"
            >
              + Add charge
            </AddChargeDialog>
          </AdminOnly>
        </div>

        <div className="mb-3.5 flex gap-2">
          <Tab active={tab === "catchup"} onClick={() => setTab("catchup")} dot="bg-teal" activeText="text-teal" label="Catch-up" left={m.ledgerRemaining} />
          <Tab active={tab === "penalty"} onClick={() => setTab("penalty")} dot="bg-wfg" activeText="text-wfg" label="Penalty" left={m.penaltyRemaining} />
        </div>

        <p className="mb-3 text-[11px] font-medium leading-[1.4] text-fnt">{cur.subtitle}</p>

        <div className="mb-[11px] flex items-center gap-[18px]">
          <LedgerStat label="Assigned" value={cur.assigned} />
          <LedgerStat label="Paid" value={cur.paid} accent />
          <LedgerStat label="Remaining" value={cur.remaining} accentClass={cur.amt} />
        </div>
        <div className="mb-[7px] h-1.5 overflow-hidden rounded-md bg-bg2">
          <div className={`h-full rounded-md ${cur.bar}`} style={{ width: `${cur.pct}%` }} />
        </div>
        <div className="text-[11px] font-medium leading-none text-fnt">{cur.pct}% paid · {cur.remaining} remaining</div>

        <EntriesList entries={cur.entries} bucket={tab} styles={cur} hidden={hidden} memberName={m.name} />
      </div>

      <AdminOnly>
        <RecordPaymentDialog
          bucket={tab}
          memberName={m.name}
          party={m.name}
          hidden={hidden}
          remainingLabel={cur.remaining}
          remainingRupees={cur.remainingRupees}
          treasurers={m.treasurerOptions}
          className={`flex w-full items-center justify-center gap-2 ${cur.bar} px-[22px] py-[15px] text-[15px] font-semibold leading-none text-white`}
        >
          <Plus className="size-[17px]" strokeWidth={2.5} /> Record {tab === "penalty" ? "penalty" : "catch-up"} payment
        </RecordPaymentDialog>
      </AdminOnly>
    </div>
  );
}

function EntriesList({ entries, bucket, styles, hidden, memberName }: { entries: LedgerEntryDTO[]; bucket: Bucket; styles: { chargeIcon: string; amt: string; suggest: ChargeSuggest }; hidden: Record<string, string>; memberName: string }) {
  const [open, setOpen] = useState(true);
  if (!entries.length) {
    return <p className="mt-4 border-t border-hr2 pt-4 text-center text-[13px] font-medium leading-[1.5] text-fnt">No charges or payments yet.</p>;
  }
  return (
    <div className="mt-4 border-t border-hr2 pt-3.5">
      <button type="button" onClick={() => setOpen((o) => !o)} className="mb-1 flex w-full items-center justify-between text-[13px] font-semibold leading-none text-ink">
        {open ? "Hide" : "Show"} {entries.length} {entries.length === 1 ? "entry" : "entries"}
        <ChevronDown className={`size-[18px] text-fnt transition-transform ${open ? "" : "-rotate-90"}`} strokeWidth={2} />
      </button>
      {open && entries.map((e) => <EntryRow key={e.id} e={e} bucket={bucket} styles={styles} hidden={hidden} memberName={memberName} />)}
    </div>
  );
}

function EntryRow({ e, bucket, styles, hidden, memberName }: { e: LedgerEntryDTO; bucket: Bucket; styles: { chargeIcon: string; amt: string }; hidden: Record<string, string>; memberName: string }) {
  const isPayment = e.kind === "payment";
  return (
    <div className="flex items-center gap-3 border-t border-hr2 py-3 first:border-t-0">
      <span className={`flex size-8 flex-none items-center justify-center rounded-[9px] ${isPayment ? "bg-tlsf text-in" : styles.chargeIcon}`}>
        {isPayment ? <Check className="size-4" strokeWidth={2.5} /> : <Plus className="size-4" strokeWidth={2.5} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold leading-tight text-ink">{e.title}</div>
        <div className="mt-0.5 text-[11px] font-medium leading-none text-fnt">{e.by} · {e.date}</div>
      </div>
      <span className={`font-mono text-[15px] font-semibold leading-none ${isPayment ? "text-in" : styles.amt}`}>{e.amount}</span>
      <AdminOnly>
        {isPayment ? (
          <FormModalButton
            title="Edit payment"
            subtitle={memberName}
            kind="editPayment"
            submitLabel="Save changes"
            hiddenFields={{ ...hidden, id: e.id }}
            fields={[
              { name: "amount", label: "Amount received", defaultValue: e.editAmount, required: true },
              { name: "date", label: "Date", type: "date", defaultValue: e.editDate },
            ]}
            buttonClassName="flex size-7 flex-none items-center justify-center rounded-[7px] border border-bd2 bg-sf text-fnt hover:bg-sf2"
            buttonAriaLabel="Edit payment"
          >
            <Pencil className="size-[13px]" strokeWidth={2} />
          </FormModalButton>
        ) : (
          <AddChargeDialog
            bucket={bucket}
            memberName={memberName}
            hidden={hidden}
            editId={e.id}
            defaults={{ amount: e.editAmount, reason: e.editReason ?? "OTHER", date: e.editDate, note: e.editNote }}
            className="flex size-7 flex-none items-center justify-center rounded-[7px] border border-bd2 bg-sf text-fnt hover:bg-sf2"
            ariaLabel="Edit charge"
          >
            <Pencil className="size-[13px]" strokeWidth={2} />
          </AddChargeDialog>
        )}
        <DeleteEntryDialog
          kind={isPayment ? "payment" : "charge"}
          bucket={bucket}
          entryId={e.id}
          memberId={hidden.memberId}
          entryLabel={e.title}
          entryAmount={e.amount}
          entryDate={e.date}
          className="flex size-7 flex-none items-center justify-center rounded-[7px] border border-bd2 bg-sf text-fnt hover:bg-wbg hover:text-out"
          ariaLabel={isPayment ? "Delete payment" : "Delete charge"}
        >
          <Trash2 className="size-[13px]" strokeWidth={2} />
        </DeleteEntryDialog>
      </AdminOnly>
    </div>
  );
}

function Tab({ active, onClick, dot, activeText, label, left }: { active: boolean; onClick: () => void; dot: string; activeText: string; label: string; left: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-[11px] border px-[13px] py-2.5 text-left transition-colors ${active ? "border-teal/40 bg-tlsf" : "border-bd2 bg-sf"}`}
    >
      <div className="flex items-center gap-[7px]">
        <span className={`size-2 rounded-[3px] ${dot}`} />
        <span className={`text-xs font-semibold leading-none ${active ? activeText : "text-mut"}`}>{label}</span>
      </div>
      <div className="mt-[9px] font-mono text-[15px] font-semibold leading-none text-ink">
        {left} <span className="font-sans text-[10px] font-medium text-fnt">left</span>
      </div>
    </button>
  );
}

function LedgerStat({ label, value, accent = false, accentClass }: { label: string; value: string; accent?: boolean; accentClass?: string }) {
  return (
    <div className="flex-1">
      <div className="text-[10px] font-medium leading-none text-mut">{label}</div>
      <div className={`mt-[7px] font-mono text-[15px] font-semibold leading-none ${accentClass ?? (accent ? "text-in" : "text-ink")}`}>{value}</div>
    </div>
  );
}
