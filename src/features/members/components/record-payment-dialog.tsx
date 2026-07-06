"use client";

import { useId, useState, useTransition } from "react";
import { Modal, ModalActions } from "@/components/shared/modal";
import { EntityPicker, type PickOption } from "@/components/shared/entity-picker";
import { AmountInput } from "@/components/shared/amount-input";
import { SectionLabel } from "@/components/shared/section-label";
import { DateInput } from "@/components/shared/date-input";
import { formAction } from "@/lib/actions-client";
import { type Bucket, Trigger, today } from "./catchup-penalty-shared";

const round = (n: number) => String(Math.round(n));

/** Record a catch-up / penalty PAYMENT. Matches the "Record penalty payment" design. */
export function RecordPaymentDialog({
  bucket, memberName, party, hidden, remainingLabel, remainingRupees, treasurers, className, children, submitLabel = "Confirm payment",
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
  submitLabel?: string;
}) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(remainingRupees > 0 ? round(remainingRupees) : "");
  const [treasurer, setTreasurer] = useState<PickOption | null>(null);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const noun = bucket === "penalty" ? "penalty" : "catch-up";

  const submit = () => {
    const n = Number(amount.replace(/,/g, ""));
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
      fd.set("note", note.trim());
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
        footer={<ModalActions onCancel={() => setOpen(false)} submitLabel={submitLabel} pending={pending} formId={formId} />}
      >
        {(
          <form id={formId} onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-4">
            <div className="rounded-xl bg-bg2 px-4 py-3">
              <div className="mb-2.5 flex items-center justify-between border-b border-hr2 pb-2.5">
                <span className="text-sm font-medium leading-none text-mut">Member</span>
                <span className="text-sm font-bold leading-none text-ink">{memberName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium leading-none text-mut">Remaining balance</span>
                <span className="font-mono text-17 font-bold leading-none text-ink">{remainingLabel}</span>
              </div>
            </div>

            <div>
              <SectionLabel>Pay amount</SectionLabel>
              <AmountInput value={amount} onChange={setAmount} autoFocus />
              {remainingRupees > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {([["Full", 1], ["½", 0.5], ["⅓", 1 / 3]] as [string, number][]).map(([label, frac]) => (
                    <button key={label} type="button" onClick={() => preset(frac)} className="rounded-10 border border-bd2 bg-sf py-2.5 text-13 font-semibold leading-none text-ink hover:bg-bg2">
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <SectionLabel>Received by (treasurer)</SectionLabel>
              <EntityPicker
                selected={treasurer}
                onPick={setTreasurer}
                options={treasurers}
                placeholder="No holder selected"
                hint="Tap to pick who receives the cash"
                searchPlaceholder="Search treasurers"
              />
            </div>

            <div>
              <SectionLabel>Transaction date (optional)</SectionLabel>
              <DateInput value={date} onChange={setDate} />
            </div>

            <div>
              <SectionLabel>Note (optional)</SectionLabel>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Add a note…"
                className="w-full resize-none rounded-xl border border-bd2 bg-transparent px-4 py-3 text-sm font-medium text-ink outline-none placeholder:text-fnt focus:border-teal"
              />
            </div>

            <p className="text-12 font-medium leading-150 text-fnt">
              Pay any amount up to the remaining balance — split it across as many instalments as you like. The money is recorded as held by the chosen treasurer.
            </p>

            {err && <p className="text-13 font-medium leading-140 text-out">{err}</p>}
          </form>
        )}
      </Modal>
    </>
  );
}
