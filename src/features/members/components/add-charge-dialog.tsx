"use client";

import { useId, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Modal, ModalActions } from "@/components/shared/modal";
import { AmountInput } from "@/components/shared/amount-input";
import { SectionLabel } from "@/components/shared/section-label";
import { formAction } from "@/server/actions";
import type { ChargeSuggest } from "@/server/queries/members";
import { type Bucket, Trigger, today } from "./catchup-penalty-shared";

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

/** Add / edit a catch-up or penalty CHARGE. Matches the "Add catch-up charge" design. */
export function AddChargeDialog({
  bucket, hidden, suggest, editId, defaults, className, ariaLabel, children,
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
                <p className="flex-1 text-12 font-medium leading-140 text-fnt">
                  <span className="font-bold text-ink">Suggested {suggest.label}</span> · {suggest.hint}
                </p>
                <button type="button" onClick={() => setAmount(suggest.rupees)} className="flex-none text-13 font-bold leading-none text-teal">Use</button>
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
                  className={`rounded-10 border px-3 py-2 text-13 font-semibold leading-none transition-colors ${
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

          {err && <p className="text-13 font-medium leading-140 text-out">{err}</p>}
        </form>
      </Modal>
    </>
  );
}
