"use client";

import { useId, useState, useTransition } from "react";
import { Modal, ModalActions } from "@/components/shared/modal";
import { SelectorCard, PickerSheet, type PickOption } from "@/components/shared/entity-picker";
import { AmountInput } from "@/components/shared/amount-input";
import { SectionLabel } from "@/components/shared/section-label";
import { formAction } from "@/server/actions";
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
        footer={picking ? undefined : <ModalActions onCancel={() => setOpen(false)} submitLabel={submitLabel} pending={pending} formId={formId} />}
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
              <span className="font-mono text-17 font-bold leading-none text-ink">{remainingLabel}</span>
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
