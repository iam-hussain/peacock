"use client";

import { useId, useState, useTransition } from "react";
import { Modal, ModalActions } from "@/components/shared/modal";
import { formAction } from "@/server/actions";
import { formatPaise } from "@/lib/money";
import { AmountInput } from "@/components/shared/amount-input";
import { SectionLabel } from "@/components/shared/section-label";
import { today } from "./catchup-penalty-modals";
import type { RejoinDTO } from "@/server/queries/members";

/**
 * Rejoin flow (PRODUCT.md §12): confirm opens a fresh membership (Active) for a member whose
 * last stint is closed, and raises the auto-suggested catch-up as a "Rejoin" charge (editable).
 * Back deposits aren't posted — they become the new membership's normal pending dues.
 */
export function RejoinDialog({
  memberId,
  memberName,
  rejoin,
  className,
  children,
}: {
  memberId: string;
  memberName: string;
  rejoin: RejoinDTO;
  className: string;
  children: React.ReactNode;
}) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [catchup, setCatchup] = useState(String(Math.round(rejoin.profitRupees)));
  const [date, setDate] = useState(today());
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const n = Number(catchup) || 0;
  const total = formatPaise((rejoin.depDueRupees + n) * 100);

  const submit = () => {
    if (!(n >= 0)) return setErr("Catch-up can't be negative.");
    start(async () => {
      const fd = new FormData();
      fd.set("memberId", memberId);
      fd.set("catchup", catchup || "0");
      fd.set("date", date);
      const res = await formAction("rejoin", fd);
      if (res.ok) {
        setErr(null);
        setOpen(false);
      } else setErr(res.error ?? "Something went wrong.");
    });
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Record rejoin & catch-up"
        subtitle={memberName}
        footer={<ModalActions onCancel={() => setOpen(false)} submitLabel="Confirm rejoin" pending={pending} formId={formId} />}
      >
        <form id={formId} onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-4">
          <div className="rounded-xl bg-bg2 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium leading-none text-mut">Back deposits</span>
              <span className="font-mono text-17 font-bold leading-none text-ink">{rejoin.depDue}</span>
            </div>
            <p className="mt-1.5 text-11 font-medium leading-140 text-fnt">
              Full monthly deposits since the club started · paid down over time as normal deposits.
            </p>
          </div>

          <div>
            <SectionLabel>Catch-up charge (per-member profit)</SectionLabel>
            <AmountInput value={catchup} onChange={setCatchup} autoFocus />
            <p className="mt-2 text-11 font-medium leading-140 text-fnt">
              Auto-suggested from the profit each active member holds. Raised as a &ldquo;Rejoin&rdquo; charge {memberName} pays down over time.
            </p>
          </div>

          <div>
            <SectionLabel>Rejoin date</SectionLabel>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-bd2 bg-transparent px-4 py-3 text-sm font-medium text-ink outline-none focus:border-teal"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-teal/30 bg-tlsf px-4 py-3">
            <span className="text-sm font-semibold leading-none text-ink">Total to rejoin</span>
            <span className="font-mono text-19 font-bold leading-none text-teal">{total}</span>
          </div>

          <p className="text-12 font-medium leading-150 text-fnt">
            Opens a new membership (Active) for {memberName} with the catch-up charge on it. The previous membership stays in history.
          </p>

          {err && <p className="text-13 font-medium leading-140 text-out">{err}</p>}
        </form>
      </Modal>
    </>
  );
}
