import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { type Vendor } from "../data";
import { FormModalButton } from "@/components/shared/form-modal-button";

type VendorStat = { label: string; value: string; tone?: "in" | "teal" };

export function VendorsList({ vendors, stats }: { vendors: Vendor[]; stats: VendorStat[] }) {
  return (
    <div className="mx-auto max-w-[1280px] p-4 pb-[78px] md:p-[26px] md:pb-[26px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Title — desktop only (mobile top-bar already shows "Vendors") */}
        <h1 className="hidden text-2xl font-bold leading-none tracking-[-0.02em] text-ink md:block">Vendors &amp; chits</h1>
        <div className="flex w-full gap-2.5 md:w-auto">
          <FormModalButton
            title="New vendor"
            subtitle="Record a general investment vendor."
            kind="newVendor"
            submitLabel="Create vendor"
            fields={[
              { name: "name", label: "Vendor name", placeholder: "e.g. HDFC Bank FD", required: true },
              { name: "category", label: "Category", options: ["Bank", "Stocks", "Gold", "Chit", "Other"] },
              { name: "invested", label: "Amount invested (₹)", type: "text", placeholder: "0" },
              { name: "date", label: "Placed on", type: "date" },
            ]}
            buttonClassName="flex-1 rounded-[9px] border border-bd2 bg-sf px-[15px] py-[11px] text-center text-[13px] font-semibold leading-none text-teal hover:bg-sf2 md:flex-none md:py-2.5"
          >
            + New vendor
          </FormModalButton>
          <FormModalButton
            title="New chit fund"
            subtitle="Set up a chit-fund vendor."
            kind="newChit"
            submitLabel="Create chit"
            fields={[
              { name: "name", label: "Chit name", placeholder: "e.g. Sri Chit Fund", required: true },
              { name: "value", label: "Chit value (₹)", placeholder: "5,00,000", required: true },
              { name: "months", label: "Duration (months)", type: "number", placeholder: "20" },
              { name: "margin", label: "Max monthly installment (₹)", placeholder: "25,000" },
              { name: "start", label: "Started on", type: "date" },
            ]}
            buttonClassName="flex-1 rounded-[9px] bg-teal px-4 py-[11px] text-center text-[13px] font-semibold leading-none text-white md:flex-none"
          >
            + New chit
          </FormModalButton>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 md:gap-3.5">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} tone={s.tone ?? "ink"} />
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-[0_1px_2px_var(--shadow)]">
        {vendors.map((v) => (
          <VendorRow key={v.id} v={v} />
        ))}
      </div>
    </div>
  );
}

function VendorRow({ v }: { v: Vendor }) {
  return (
    <Link
      href={`/vendors/${v.id}`}
      className="flex items-center gap-3.5 border-b border-hr2 px-[18px] py-4 transition-colors last:border-b-0 hover:bg-sf2"
    >
      <span className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-teal-dark text-xs font-bold text-white">
        {v.ini}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-sm font-semibold leading-none text-ink">{v.name}</span>
          <span
            className={`rounded-md px-[7px] py-[3px] text-[8px] font-bold uppercase leading-none tracking-[0.05em] ${
              v.type === "chit" ? "bg-wbg text-wfg" : "bg-tlsf text-teal"
            }`}
          >
            {v.typeLabel}
          </span>
          <StatusBadge status={v.status} label={v.statusLabel} />
        </div>
        <div className="mt-1.5 text-[11px] font-medium leading-[1.3] text-fnt">
          {v.cycle} · invested {v.invested}
        </div>
      </div>
      <div className="text-right">
        <div className={`font-mono text-base font-semibold leading-none ${v.roiPositive ? "text-in" : "text-out"}`}>
          {v.roi}
        </div>
        <div className="mt-1 font-mono text-[11px] font-medium leading-[1.3] text-fnt">{v.profit}</div>
      </div>
      <ChevronRight className="size-4 flex-none text-fnt" strokeWidth={2} />
    </Link>
  );
}
