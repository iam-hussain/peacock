"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import type { Member } from "../data";
import { MembersTable } from "./members-table";

type Filter = "all" | "active" | "inactive";
const LABELS: Record<Filter, string> = { all: "All members", active: "Active", inactive: "Inactive" };

/** Desktop members card: live search + status filter over the table. */
export function MembersBrowser({ members }: { members: Member[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      const matchesText = !q || m.name.toLowerCase().includes(q);
      const matchesStatus = filter === "all" || (filter === "active" ? m.status === "active" : m.status !== "active");
      return matchesText && matchesStatus;
    });
  }, [members, query, filter]);

  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-hair px-5 py-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members…"
          className="flex-1 rounded-[10px] border border-bd2 bg-transparent px-[13px] py-2.5 text-[13px] font-medium leading-none text-ink outline-none placeholder:text-fnt focus:border-teal"
        />
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-bd2 px-3 py-[9px] text-xs font-semibold leading-none text-mut hover:bg-sf2"
          >
            {LABELS[filter]} <ChevronDown className={`size-3 text-fnt transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <>
              <button className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Close filter" />
              <div className="absolute right-0 top-[38px] z-[41] w-[160px] overflow-hidden rounded-[11px] border border-bd bg-sf p-1 shadow-[0_1px_2px_var(--shadow),0_14px_34px_var(--shadow)]">
                {(Object.keys(LABELS) as Filter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => { setFilter(f); setOpen(false); }}
                    className="flex w-full items-center justify-between rounded-[8px] px-[11px] py-2 text-left text-[13px] font-semibold text-ink hover:bg-bg2"
                  >
                    {LABELS[f]}
                    {filter === f && <Check className="size-3.5 text-teal" strokeWidth={2.4} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {rows.length ? (
        <div className="overflow-x-auto">
          <MembersTable members={rows} />
        </div>
      ) : (
        <div className="px-5 py-14 text-center text-[13px] font-medium text-fnt">No members match.</div>
      )}
    </>
  );
}
