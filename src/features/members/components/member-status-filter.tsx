"use client";

import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { MEMBER_FILTER_LABELS, type MemberFilter } from "../filter";

/** Active / Inactive / All members status filter dropdown (shared by desktop + mobile). */
export function MemberStatusFilter({ value, onChange }: { value: MemberFilter; onChange: (f: MemberFilter) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-bd2 px-3 py-2.25 text-xs font-semibold leading-none text-mut hover:bg-sf2"
      >
        {MEMBER_FILTER_LABELS[value]} <ChevronDown className={`size-3 text-fnt transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Close filter" />
          <div className="absolute right-0 top-9.5 z-[41] w-[160px] overflow-hidden rounded-11 border border-bd bg-sf p-1 shadow-[0_1px_2px_var(--shadow),0_14px_34px_var(--shadow)]">
            {(Object.keys(MEMBER_FILTER_LABELS) as MemberFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => { onChange(f); setOpen(false); }}
                className="flex w-full items-center justify-between rounded-8 px-2.75 py-2 text-left text-13 font-semibold text-ink hover:bg-bg2"
              >
                {MEMBER_FILTER_LABELS[f]}
                {value === f && <Check className="size-3.5 text-teal" strokeWidth={2.4} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
