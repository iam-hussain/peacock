"use client"; // renderable inside the client-side Share poster (props stay serializable DTOs)

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { type Vendor } from "../data";
import { FormModalButton } from "@/components/shared/form-modal-button";
import { NewChitDialog } from "./new-chit-dialog";
import { AdminOnly } from "@/lib/admin";
import { useInPoster } from "@/lib/poster";

type VendorStat = { label: string; value: string; tone?: "in" | "teal" };

// A general vendor is any place the club parks capital — the type is a display label only.
const VENDOR_TYPES = [
  { value: "Stocks", label: "Stocks" },
  { value: "Bank", label: "Bank deposit" },
  { value: "Mutual fund", label: "Mutual fund" },
  { value: "Bonds", label: "Bonds" },
  { value: "Gold", label: "Gold" },
  { value: "Trading firm", label: "Trading firm" },
  { value: "Other", label: "Other" },
];

// Last 8 calendar quarters up to the current one, newest first. Value = quarter-start date.
function quarterOptions(): { value: string; label: string }[] {
  const now = new Date();
  const qStartMonth = Math.floor(now.getUTCMonth() / 3) * 3; // 0,3,6,9
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), qStartMonth - i * 3, 1));
    const q = Math.floor(d.getUTCMonth() / 3) + 1;
    return { value: d.toISOString().slice(0, 10), label: `Q${q} ${d.getUTCFullYear()}` };
  });
}

export function VendorsList({ vendors, stats }: { vendors: Vendor[]; stats: VendorStat[] }) {
  const inPoster = useInPoster();
  const cycles = quarterOptions();
  return (
    <div className={`mx-auto max-w-320 ${inPoster ? "p-6.5" : "p-4 pb-19.5 md:p-6.5 md:pb-6.5"}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Title — desktop only (forced in the poster regardless of viewport) */}
        <h1 className={`text-2xl font-bold leading-none tracking-[-0.02em] text-ink ${inPoster ? "block" : "hidden md:block"}`}>Vendors &amp; chits</h1>
        <AdminOnly>
        <div className="flex w-full gap-2.5 md:w-auto">
          <FormModalButton
            title="Add a vendor"
            subtitle="A general vendor is any place the club parks capital — stocks, a bank deposit, a trading firm. Returns are recorded as they come in."
            kind="newVendor"
            submitLabel="Add vendor"
            outro={
              <p className="rounded-11 bg-sf2 px-3.5 py-3 text-12 font-medium leading-150 text-mut">
                Invested capital and returns are tracked automatically from <span className="font-semibold text-ink">transactions</span> — record a vendor investment or return entry, no amount is set here.
              </p>
            }
            fields={[
              { name: "name", label: "Vendor name", placeholder: "e.g. Surya Traders", required: true },
              { name: "category", label: "Type", options: VENDOR_TYPES, half: true },
              { name: "cycle", label: "Cycle", options: cycles, half: true },
            ]}
            buttonClassName="flex-1 rounded-9 border border-bd2 bg-sf px-3.75 py-2.75 text-center text-13 font-semibold leading-none text-teal hover:bg-sf2 md:flex-none md:py-2.5"
          >
            + New vendor
          </FormModalButton>
          <NewChitDialog buttonClassName="flex-1 rounded-9 bg-teal px-4 py-2.75 text-center text-13 font-semibold leading-none text-white md:flex-none">
            + New chit
          </NewChitDialog>
        </div>
        </AdminOnly>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 md:gap-3.5">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} tone={s.tone ?? "ink"} />
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-card">
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
      prefetch={false}
      href={`/vendors/${v.id}`}
      className="flex items-center gap-3.5 border-b border-hr2 px-4.5 py-4 transition-colors last:border-b-0 hover:bg-sf2"
    >
      <span className="flex size-9 flex-none items-center justify-center rounded-10 bg-teal-dark text-xs font-bold text-white">
        {v.ini}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-sm font-semibold leading-none text-ink">{v.name}</span>
          <span
            className={`rounded-md px-1.75 py-0.75 text-8 font-bold uppercase leading-none tracking-5 ${
              v.type === "chit" ? "bg-wbg text-wfg" : "bg-tlsf text-teal"
            }`}
          >
            {v.typeLabel}
          </span>
          <StatusBadge status={v.status} label={v.statusLabel} />
        </div>
        <div className="mt-1.5 text-11 font-medium leading-130 text-fnt">
          {v.cycle} · invested {v.invested}
          {v.obligation && <span className="text-out"> · owes {v.obligation}</span>}
        </div>
      </div>
      <div className="text-right">
        <div className={`font-mono text-base font-semibold leading-none ${v.roiPositive ? "text-in" : "text-out"}`}>
          {v.profit}
        </div>
        <div className="mt-1 font-mono text-11 font-medium leading-130 text-fnt">{v.roi}</div>
      </div>
      <ChevronRight className="size-4 flex-none text-fnt" strokeWidth={2} />
    </Link>
  );
}
