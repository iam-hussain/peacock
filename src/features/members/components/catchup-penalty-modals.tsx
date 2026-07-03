"use client";

import { useId, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Modal, ModalActions } from "@/components/shared/modal";
import { SelectorCard, PickerSheet, type PickOption } from "@/components/shared/entity-picker";
import { formAction } from "@/server/actions";
import type { ChargeSuggest } from "@/server/queries/members";

type Bucket = "catchup" | "penalty";

const REASONS: Record<Bucket, [string, string][]> = {
  catchup: [
    ["FIRST_TIME_JOIN", "First-time join"],
    ["REJOIN", "Rejoin"],
    ["PROFIT_GAP_TOPUP", "Profit-gap top-up"],
    ["MID_TERM_EQUALISATION", "Mid-term equalisation"],
    ["OTHER", "Other"],
  ],
  penalty: [
    ["DELAYED_PAYMENT", "Delayed payment"],
    ["LOAN_REPAYMENT_DELAY", "Loan repayment delay"],
    ["HOLDING_TOO_LONG", "Holding too long"],
    ["MISSED_DEPOSIT", "Missed deposit"],
    ["OTHER", "Other"],
  ],
};

export const today = () => new Date().toISOString().slice(0, 10);
const round = (n: number) => String(Math.round(n));

function Trigger({ onOpen, className, ariaLabel, children }: { onOpen: () => void; className: string; ariaLabel?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onOpen} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

export function AmountInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 transition-colors focus-within:border-teal ${value ? "border-teal" : "border-bd2"}`}>
      <span className="font-mono text-[22px] font-semibold leading-none text-mut">₹</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        autoFocus={autoFocus}
        placeholder="0"
        className="w-full bg-transparent font-mono text-[22px] font-semibold leading-none text-ink outline-none placeholder:text-fnt"
      />
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-bold uppercase leading-none tracking-[0.05em] text-fnt">{children}</div>;
}

/** Add / edit a catch-up or penalty CHARGE. Matches the "Add catch-up charge" design. */
export function AddChargeDialog({
  bucket, memberName, hidden, suggest, editId, defaults, className, ariaLabel, children,
}: {
  bucket: Bucket;
  memberName: string;
  hidden: Record<string, string>;
  suggest?: ChargeSuggest;
  editId?: string;
  defaults?: { amount: string; reason: string; date: string; note?: string };
  className: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(defaults?.amount ?? "");
  const [reason, setReason] = useState(defaults?.reason ?? REASONS[bucket][0][0]);
  // Free-text reason shown for the "Other" chip (reason is a fixed enum, so the custom
  // wording is stored in the note column and rendered as the entry's reason).
  const [otherReason, setOtherReason] = useState(defaults?.note ?? "");
  const [date, setDate] = useState(defaults?.date ?? today());
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const noun = bucket === "penalty" ? "penalty" : "catch-up";
  const isOther = reason === "OTHER";

  const submit = () => {
    if (!amount.trim()) return setErr("Enter an amount.");
    if (isOther && !otherReason.trim()) return setErr("Describe the reason for the ‘Other’ charge.");
    start(async () => {
      const fd = new FormData();
      Object.entries(hidden).forEach(([k, v]) => fd.set(k, v));
      if (editId) fd.set("id", editId);
      fd.set("type", bucket === "penalty" ? "Penalty" : "Catch-up");
      fd.set("amount", amount);
      fd.set("reason", reason);
      fd.set("note", isOther ? otherReason.trim() : "");
      fd.set("date", date);
      const res = await formAction(editId ? "editCharge" : "addCharge", fd);
      if (res.ok) { setErr(null); setOpen(false); }
      else setErr(res.error ?? "Something went wrong.");
    });
  };

  return (
    <>
      <Trigger onOpen={() => setOpen(true)} className={className} ariaLabel={ariaLabel}>{children}</Trigger>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${editId ? "Edit" : "Add"} ${noun} charge`}
        subtitle={`Assign an amount this member owes. They pay it down later in any number of instalments.`}
        footer={<ModalActions onCancel={() => setOpen(false)} submitLabel={editId ? "Save changes" : "Save charge"} pending={pending} formId={formId} />}
      >
        <form id={formId} onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-5">
          <div>
            <SectionLabel>Amount</SectionLabel>
            <AmountInput value={amount} onChange={setAmount} autoFocus />
            {suggest && !editId && (
              <div className="mt-2 flex items-center gap-3 rounded-xl bg-tlsf px-3.5 py-3">
                <Sparkles className="size-4 flex-none text-teal" strokeWidth={2} />
                <p className="flex-1 text-[12px] font-medium leading-[1.4] text-fnt">
                  <span className="font-bold text-ink">Suggested {suggest.label}</span> · {suggest.hint}
                </p>
                <button type="button" onClick={() => setAmount(suggest.rupees)} className="flex-none text-[13px] font-bold leading-none text-teal">Use</button>
              </div>
            )}
          </div>

          <div>
            <SectionLabel>Reason</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {REASONS[bucket].map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setReason(v)}
                  className={`rounded-[10px] border px-3 py-2 text-[13px] font-semibold leading-none transition-colors ${
                    reason === v ? "border-teal bg-tlsf text-teal" : "border-bd2 bg-sf text-ink hover:bg-bg2"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {isOther && (
              <textarea
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                rows={2}
                placeholder="Describe the reason…"
                className="mt-2 w-full resize-none rounded-xl border border-bd2 bg-transparent px-4 py-3 text-sm font-medium text-ink outline-none placeholder:text-fnt focus:border-teal"
              />
            )}
          </div>

          <div>
            <SectionLabel>Date</SectionLabel>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-bd2 bg-transparent px-4 py-3 text-sm font-medium text-ink outline-none focus:border-teal"
            />
          </div>

          {err && <p className="text-[13px] font-medium leading-[1.4] text-out">{err}</p>}
        </form>
      </Modal>
    </>
  );
}

/** Delete a catch-up / penalty CHARGE or PAYMENT, with a confirm step. */
export function DeleteEntryDialog({
  kind, bucket, entryId, memberId, entryLabel, entryAmount, entryDate, className, ariaLabel, children,
}: {
  kind: "charge" | "payment";
  bucket: Bucket;
  entryId: string;
  memberId: string;
  entryLabel: string;
  entryAmount: string;
  entryDate: string;
  className: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const noun = bucket === "penalty" ? "penalty" : "catch-up";
  const what = kind === "payment" ? "payment" : "charge";

  const remove = () => {
    start(async () => {
      const fd = new FormData();
      fd.set("id", entryId);
      fd.set("memberId", memberId);
      const res = await formAction(kind === "payment" ? "deletePayment" : "deleteCharge", fd);
      if (res.ok) { setErr(null); setOpen(false); }
      else setErr(res.error ?? "Could not delete.");
    });
  };

  return (
    <>
      <Trigger onOpen={() => setOpen(true)} className={className} ariaLabel={ariaLabel}>{children}</Trigger>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Delete ${noun} ${what}?`}
        subtitle={`${entryLabel} · ${entryAmount} · ${entryDate}`}
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-bd2 bg-sf py-3 text-sm font-semibold leading-none text-ink hover:bg-bg2">
              Cancel
            </button>
            <button type="button" onClick={remove} disabled={pending} className="flex-1 rounded-xl bg-out py-3 text-sm font-semibold leading-none text-white disabled:opacity-60">
              {pending ? "Deleting…" : "Delete"}
            </button>
          </>
        }
      >
        <p className="text-[13px] font-medium leading-[1.5] text-fnt">
          {kind === "payment"
            ? "This reverses the recorded payment and its ledger entries. The remaining balance goes back up. This can't be undone."
            : "This removes the charge (the amount owed). This can't be undone."}
        </p>
        {err && <p className="mt-3 text-[13px] font-medium leading-[1.4] text-out">{err}</p>}
      </Modal>
    </>
  );
}

/** Record a catch-up / penalty PAYMENT. Matches the "Record penalty payment" design. */
export function RecordPaymentDialog({
  bucket, memberName, party, hidden, remainingLabel, remainingRupees, treasurers, className, children,
}: {
  bucket: Bucket;
  memberName: string;
  party: string;
  hidden: Record<string, string>;
  remainingLabel: string;
  remainingRupees: number;
  treasurers: PickOption[];
  className: string;
  children: React.ReactNode;
}) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [amount, setAmount] = useState(remainingRupees > 0 ? round(remainingRupees) : "");
  const [treasurer, setTreasurer] = useState<PickOption | null>(null);
  const [date, setDate] = useState(today());
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const noun = bucket === "penalty" ? "penalty" : "catch-up";

  const submit = () => {
    const n = Number(amount);
    if (!amount.trim() || !(n > 0)) return setErr("Enter an amount greater than zero.");
    if (remainingRupees > 0 && n > remainingRupees + 0.5) return setErr(`Amount can't exceed the ${remainingLabel} remaining.`);
    if (!treasurer) return setErr("Pick the treasurer who received the cash.");
    start(async () => {
      const fd = new FormData();
      Object.entries(hidden).forEach(([k, v]) => fd.set(k, v));
      fd.set("type", bucket === "penalty" ? "Penalty" : "Catch-up");
      fd.set("party", party);
      fd.set("amount", amount);
      fd.set("treasurer", treasurer.name);
      fd.set("date", date);
      const res = await formAction("recordPayment", fd);
      if (res.ok) { setErr(null); setOpen(false); }
      else setErr(res.error ?? "Something went wrong.");
    });
  };

  const preset = (frac: number) => setAmount(round(remainingRupees * frac));

  return (
    <>
      <Trigger onOpen={() => setOpen(true)} className={className}>{children}</Trigger>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Record ${noun} payment`}
        subtitle={memberName}
        hideHeader={picking}
        footer={picking ? undefined : <ModalActions onCancel={() => setOpen(false)} submitLabel="Confirm payment" pending={pending} formId={formId} />}
      >
        {picking ? (
          <PickerSheet
            title="Cash holder"
            subtitle="Choose the treasurer who receives the cash."
            searchPlaceholder="Search treasurers"
            options={treasurers}
            onPick={(o) => { setTreasurer(o); setPicking(false); }}
            onBack={() => setPicking(false)}
          />
        ) : (
          <form id={formId} onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-xl bg-bg2 px-4 py-3">
              <span className="text-sm font-medium leading-none text-mut">Remaining balance</span>
              <span className="font-mono text-[17px] font-bold leading-none text-ink">{remainingLabel}</span>
            </div>

            <div>
              <SectionLabel>Pay amount</SectionLabel>
              <AmountInput value={amount} onChange={setAmount} autoFocus />
              {remainingRupees > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {([["Full", 1], ["½", 0.5], ["⅓", 1 / 3]] as [string, number][]).map(([label, frac]) => (
                    <button key={label} type="button" onClick={() => preset(frac)} className="rounded-[10px] border border-bd2 bg-sf py-2.5 text-[13px] font-semibold leading-none text-ink hover:bg-bg2">
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <SectionLabel>Received by (treasurer)</SectionLabel>
              <SelectorCard
                selected={treasurer}
                placeholder="No holder selected"
                hint="Tap to pick who receives the cash"
                onOpen={() => setPicking(true)}
              />
            </div>

            <div>
              <SectionLabel>Transaction date (optional)</SectionLabel>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-bd2 bg-transparent px-4 py-3 text-sm font-medium text-ink outline-none focus:border-teal"
              />
            </div>

            <p className="text-[12px] font-medium leading-[1.5] text-fnt">
              Pay any amount up to the remaining balance — split it across as many instalments as you like. The money is recorded as held by the chosen treasurer.
            </p>

            {err && <p className="text-[13px] font-medium leading-[1.4] text-out">{err}</p>}
          </form>
        )}
      </Modal>
    </>
  );
}
