"use client";

import { useId, useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { Modal, ModalActions } from "@/components/shared/modal";
import { EntityPicker, type PickOption } from "@/components/shared/entity-picker";
import { formAction } from "@/lib/actions-client";
import { AmountInput } from "@/components/shared/amount-input";
import { SectionLabel } from "@/components/shared/section-label";
import { today } from "./catchup-penalty-modals";
import type { SettleDTO } from "@/server/queries/members";
import { DateInput } from "@/components/shared/date-input";

/**
 * Settle up & leave (PRODUCT.md §12): shows the computed settlement guide (capital + profit −
 * loan − unpaid interest), lets the admin enter the final cash paid out and pick the treasurer,
 * then closes the membership. The member becomes inactive (and can later rejoin).
 */
export function SettleDialog({
  memberId,
  memberName,
  settle,
  treasurers,
  className,
  children,
}: {
  memberId: string;
  memberName: string;
  settle: SettleDTO;
  treasurers: PickOption[];
  className: string;
  children: React.ReactNode;
}) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(Math.round(settle.guideRupees)));
  const [treasurer, setTreasurer] = useState<PickOption | null>(null);
  const [date, setDate] = useState(today());
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    const n = Number(amount.replace(/,/g, ""));
    if (!amount.trim() || Number.isNaN(n) || n < 0) return setErr("Enter the final amount paid out.");
    if (!treasurer) return setErr("Pick the treasurer paying the member out.");
    start(async () => {
      const fd = new FormData();
      fd.set("memberId", memberId);
      fd.set("party", memberName);
      fd.set("amount", amount);
      fd.set("treasurerId", treasurer.id);
      fd.set("date", date);
      const res = await formAction("settle", fd);
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
        title="Settle up & leave"
        subtitle={memberName}
        footer={<ModalActions onCancel={() => setOpen(false)} submitLabel="Settle & close" pending={pending} formId={formId} destructive />}
      >
        {(
          <form id={formId} onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-4">
            <div className="rounded-xl border border-bd bg-bg2 px-4 py-3.5">
              <div className="mb-2.5 text-11 font-bold uppercase leading-none tracking-5 text-fnt">Settlement guide</div>
              <GuideRow label="Paid-in capital" value={settle.capital} />
              <GuideRow label="Profit share" value={`+ ${settle.profit}`} tone="in" />
              {settle.owes && (
                <>
                  <GuideRow label="Loan outstanding" value={`− ${settle.loan}`} tone="out" />
                  <GuideRow label="Unpaid interest" value={`− ${settle.interest}`} tone="out" />
                </>
              )}
              <div className="mt-1 flex items-center justify-between border-t border-bd pt-2.5">
                <span className="text-13 font-bold leading-none text-ink">Suggested payout</span>
                <span className="font-mono text-17 font-bold leading-none text-ink">{settle.guide}</span>
              </div>
            </div>

            <div>
              <SectionLabel>Final amount paid out</SectionLabel>
              <AmountInput value={amount} onChange={setAmount} autoFocus />
              <p className="mt-2 text-11 font-medium leading-140 text-fnt">
                The admin may pay slightly less than the guide. Paid in cash from the chosen treasurer.
              </p>
            </div>

            <div>
              <SectionLabel>Paid out by (treasurer)</SectionLabel>
              <EntityPicker
                selected={treasurer}
                onPick={setTreasurer}
                options={treasurers}
                placeholder="No holder selected"
                hint="Tap to pick who pays the member out"
                searchPlaceholder="Search treasurers"
              />
            </div>

            <div>
              <SectionLabel>Leave date</SectionLabel>
              <DateInput value={date} onChange={setDate} />
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-outbd bg-outbg px-4 py-3">
              <LogOut className="mt-0.5 size-3.75 flex-none text-out" strokeWidth={2} />
              <p className="text-12 font-medium leading-150 text-out">
                Closes {memberName}&rsquo;s membership. Their profit becomes zero and the stint moves to history — they can rejoin later.
              </p>
            </div>

            {err && <p className="text-13 font-medium leading-140 text-out">{err}</p>}
          </form>
        )}
      </Modal>
    </>
  );
}

function GuideRow({ label, value, tone }: { label: string; value: string; tone?: "in" | "out" }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-13 font-medium leading-none text-mut">{label}</span>
      <span className={`font-mono text-sm font-semibold leading-none ${tone === "in" ? "text-in" : tone === "out" ? "text-out" : "text-ink"}`}>
        {value}
      </span>
    </div>
  );
}
