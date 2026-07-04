"use client";

import { Search, Plus } from "lucide-react";
import { useAddEntry } from "@/features/entries/add-entry";

export function SearchBox({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  return (
    <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-10 border border-bd2 px-3">
      <Search className="size-3.75 flex-none text-fnt" strokeWidth={2} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search member, type, amount…"
        className="min-w-0 flex-1 bg-transparent py-2.75 text-13 font-medium text-ink outline-none placeholder:text-fnt"
      />
    </div>
  );
}

export function Empty() {
  return (
    <div className="px-4 py-13 text-center text-sm font-semibold text-ink">No transactions match these filters</div>
  );
}

export function Legend({ bare = false }: { bare?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-3.75 ${bare ? "" : "border-b border-hair px-5.5 py-2.5"}`}>
      <span className="text-10 font-semibold uppercase leading-none tracking-5 text-fnt">Parties</span>
      <LegendItem dot="bg-teal" cls="text-teal" label="Treasurer" />
      <LegendItem dot="bg-ink" cls="text-ink" label="Member" />
      <LegendItem dot="bg-wfg" cls="text-wfg" label="Vendor / chit" />
    </div>
  );
}

function LegendItem({ dot, cls, label }: { dot: string; cls: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-11 font-semibold leading-none ${cls}`}>
      <span className={`size-1.75 rounded-full ${dot}`} /> {label}
    </span>
  );
}

export function AddEntryButton() {
  const addEntry = useAddEntry();
  return (
    <button
      type="button"
      onClick={() => addEntry.open()}
      className="inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-2.5 text-13 font-semibold leading-none text-white transition-opacity hover:opacity-90"
    >
      <Plus className="size-4" strokeWidth={2.5} /> Add entry
    </button>
  );
}
