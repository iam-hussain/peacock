"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/shared/modal";
import { formAction } from "@/lib/actions-client";
import { type Bucket, Trigger } from "./catchup-penalty-shared";

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
        <p className="text-13 font-medium leading-150 text-fnt">
          {kind === "payment"
            ? "This reverses the recorded payment and its ledger entries. The remaining balance goes back up. This can't be undone."
            : "This removes the charge (the amount owed). This can't be undone."}
        </p>
        {err && <p className="mt-3 text-13 font-medium leading-140 text-out">{err}</p>}
      </Modal>
    </>
  );
}
