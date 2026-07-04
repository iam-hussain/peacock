import Link from "next/link";
import { Pencil, XCircle } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { FormModalButton } from "@/components/shared/form-modal-button";
import { AdminOnly } from "@/lib/admin";
import { RecordReturnButton } from "./record-vendor-button";
import type { ChitDetail, GeneralDetail } from "../data";

function EditVendorButton({
  id, name, chit = false, category = "", statusLabel = "Active", value = "", months = "", margin = "",
}: {
  id: string; name: string; chit?: boolean; category?: string; statusLabel?: string; value?: string; months?: string; margin?: string;
}) {
  return (
    <FormModalButton
      title={chit ? "Edit chit details" : "Edit vendor details"}
      subtitle={name}
      kind="editVendor"
      submitLabel="Save changes"
      hiddenFields={{ id }}
      fields={
        chit
          ? [
              { name: "name", label: "Chit name", defaultValue: name, required: true },
              { name: "value", label: "Chit value (₹)", defaultValue: value },
              { name: "months", label: "Duration (months)", type: "number", defaultValue: months },
              { name: "margin", label: "Max monthly (₹)", defaultValue: margin },
            ]
          : [
              { name: "name", label: "Vendor name", defaultValue: name, required: true },
              { name: "category", label: "Type", options: [
                { value: "Stocks", label: "Stocks" }, { value: "Bank", label: "Bank deposit" },
                { value: "Mutual fund", label: "Mutual fund" }, { value: "Bonds", label: "Bonds" },
                { value: "Gold", label: "Gold" }, { value: "Trading firm", label: "Trading firm" },
                { value: "Other", label: "Other" },
              ], defaultValue: category },
              { name: "status", label: "Status", options: ["Active", "Inactive", "Closed"], defaultValue: statusLabel },
            ]
      }
      buttonClassName="flex flex-none items-center gap-[7px] rounded-[9px] border border-bd2 bg-sf px-4 py-2.5 text-[13px] font-semibold leading-none text-teal hover:bg-sf2"
    >
      <Pencil className="size-3.5" strokeWidth={2} /> Edit details
    </FormModalButton>
  );
}

function WriteOffButton({ id, name }: { id: string; name: string }) {
  return (
    <FormModalButton
      title="Write off vendor"
      subtitle={`Record a loss on ${name}. This posts a write-off entry.`}
      kind="vendorWriteOff"
      submitLabel="Write off"
      destructive
      hiddenFields={{ party: name, vendorId: id }}
      fields={[
        { name: "amount", label: "Write-off amount (₹)", placeholder: "0", required: true },
        { name: "reason", label: "Reason", type: "textarea", placeholder: "Why is this being written off?" },
        { name: "date", label: "Date", type: "date" },
      ]}
      buttonClassName="flex items-center gap-[7px] rounded-[9px] border border-bd2 bg-sf px-4 py-2.5 text-[13px] font-semibold leading-none text-out hover:bg-outbg"
    >
      <XCircle className="size-3.5" strokeWidth={2} /> Write off
    </FormModalButton>
  );
}

function Tile({ ini }: { ini: string }) {
  return (
    <span className="flex size-[54px] flex-none items-center justify-center rounded-[14px] bg-teal-dark text-[17px] font-bold text-white">
      {ini}
    </span>
  );
}

function BackLink() {
  return (
    <Link href="/vendors" className="mb-4 inline-block text-[13px] font-semibold leading-none text-teal">
      ← All vendors &amp; chits
    </Link>
  );
}

function PanelHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex items-center justify-between border-b border-hair px-[22px] py-[18px]">
      <span className="text-[15px] font-bold leading-none text-ink">{title}</span>
      <span className="text-xs font-medium leading-none text-fnt">{note}</span>
    </div>
  );
}

export function ChitDetailView({ c }: { c: ChitDetail }) {
  return (
    <div className="mx-auto max-w-[1280px] p-4 pb-[78px] md:p-[26px] md:pb-[26px]">
      <BackLink />
      <div className="mb-[18px] flex flex-col gap-3.5 md:flex-row md:flex-wrap md:items-center">
        <div className="flex items-center gap-3.5 md:contents">
          <Tile ini={c.ini} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-2xl font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">{c.name}</h1>
              <span className="rounded-md bg-wbg px-2 py-1 text-[8px] font-bold uppercase leading-none tracking-[0.05em] text-wfg">
                Chit fund
              </span>
            </div>
            <p className="mt-1.5 text-xs font-medium leading-[1.4] text-mut">
              Started {c.start} · {c.months} months · paid {c.paidCount} of {c.months}
            </p>
          </div>
        </div>
        <AdminOnly>
          <div className="flex items-center gap-2 md:flex-none">
            <EditVendorButton id={c.id} name={c.name} chit value={String(c.valueRupees)} months={String(c.months)} margin={String(c.marginRupees)} />
          </div>
        </AdminOnly>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-3.5">
        <StatCard label="Chit value" value={c.valueDisp} />
        <StatCard label="Max monthly (margin)" value={c.marginDisp} accent />
        <StatCard label="Paid to date" value={c.totalPaidDisp} />
        <StatCard label="Obligation left" value={c.obligationDisp} tone="warn" />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[1.3fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-[0_1px_2px_var(--shadow)]">
          <PanelHead title="Installments" note="amounts rise toward the margin" />
          <div className="max-h-[360px] overflow-y-auto">
            {c.installments.map((i) => (
              <div
                key={i.n}
                className={`flex items-center gap-3 border-b border-hr2 px-[22px] py-[11px] last:border-b-0 ${
                  i.paid ? "" : "bg-sf2/40"
                }`}
              >
                <span className={`size-[9px] flex-none rounded-full ${i.paid ? "bg-teal" : "bg-bd2"}`} />
                <span className="flex-1 text-[13px] font-semibold leading-none text-ink">Month {i.n}</span>
                {i.isPayout && (
                  <span className="rounded-md bg-wbg px-[7px] py-[3px] text-[8px] font-bold uppercase leading-none tracking-[0.05em] text-wfg">
                    Payout
                  </span>
                )}
                <span className="w-[42px] text-right text-[11px] font-medium leading-none text-fnt">{i.lbl}</span>
                <span className="w-[90px] text-right font-mono text-[13px] font-semibold leading-none text-ink">
                  {i.amt}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-teal p-5 text-white">
            <div className="text-[11px] font-semibold uppercase leading-none tracking-[0.04em] text-teal-ink">Payout</div>
            <div className="my-3 font-mono text-[28px] font-semibold leading-none">{c.payoutDisp}</div>
            <div className="text-xs font-semibold leading-none text-teal-soft">
              {c.taken ? `Taken in month ${c.payoutMonth}` : "Not taken yet · still bidding"}
            </div>
          </div>
          <div className="rounded-2xl border border-bd bg-sf p-5">
            <div className="text-[10px] font-semibold uppercase leading-none tracking-[0.05em] text-fnt">Profit / loss</div>
            <div className={`mt-[11px] font-mono text-[30px] font-semibold leading-none ${c.roiPositive ? "text-in" : "text-out"}`}>
              {c.profit}
            </div>
            <p className="mt-[9px] text-xs font-medium leading-[1.5] text-mut">
              Realized profit minus the obligation still owed. While months remain uncovered a negative figure is
              the cost of the installments the club must still pay.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GeneralDetailView({ g }: { g: GeneralDetail }) {
  return (
    <div className="mx-auto max-w-[1280px] p-4 pb-[78px] md:p-[26px] md:pb-[26px]">
      <BackLink />
      <div className="mb-[18px] flex flex-col gap-3.5 md:flex-row md:flex-wrap md:items-center">
        <div className="flex items-center gap-3.5 md:contents">
          <Tile ini={g.ini} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">{g.name}</h1>
              <span className="rounded-md bg-tlsf px-2 py-1 text-[8px] font-bold uppercase leading-none tracking-[0.05em] text-teal">
                {g.category}
              </span>
              <StatusBadge status={g.status} label={g.statusLabel} />
            </div>
            <p className="mt-1.5 text-xs font-medium leading-[1.4] text-mut">
              Placed {g.placed} · cycle {g.cycle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:flex-none">
          <RecordReturnButton vendorId={g.id} vendorName={g.name} />
          <AdminOnly>
            <WriteOffButton id={g.id} name={g.name} />
            <EditVendorButton id={g.id} name={g.name} category={g.category} statusLabel={g.statusLabel} />
          </AdminOnly>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-3.5">
        <StatCard label="Invested" value={g.investedDisp} />
        <StatCard label="Returns to date" value={g.returnsDisp} tone="in" />
        <StatCard label="Current value" value={g.currentDisp} />
        <StatCard label="ROI" value={g.roi} accent />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[1.3fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-[0_1px_2px_var(--shadow)]">
          <PanelHead title="Returns received" note="most recent first" />
          <div className="max-h-[360px] overflow-y-auto">
            {g.history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-hr2 px-[22px] py-[13px] last:border-b-0">
                <span className="size-[9px] flex-none rounded-full bg-in" />
                <span className="flex-1 text-[13px] font-semibold leading-none text-ink">{h.month}</span>
                <span className="font-mono text-[13px] font-semibold leading-none text-in">+{h.amt}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-teal p-5 text-white">
            <div className="text-[11px] font-semibold uppercase leading-none tracking-[0.04em] text-teal-ink">Net gain</div>
            <div className="my-3 font-mono text-[28px] font-semibold leading-none">{g.returnsDisp}</div>
            <div className="text-xs font-semibold leading-none text-teal-soft">Last return · {g.lastReturn}</div>
          </div>
          <div className="rounded-2xl border border-bd bg-sf p-5">
            <div className="text-[10px] font-semibold uppercase leading-none tracking-[0.05em] text-fnt">Status</div>
            <div className="mt-[11px] text-[22px] font-bold leading-none text-ink">{g.statusLabel}</div>
            <p className="mt-[9px] text-xs font-medium leading-[1.5] text-mut">
              {g.status === "settled"
                ? "Closed — capital fully returned. Kept for the record."
                : g.status === "inactive"
                  ? "Paused — no new capital placed. Reactivate to record returns again."
                  : "Capital is placed and earning. Record each return as it comes in."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
