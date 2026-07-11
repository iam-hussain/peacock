"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Pager } from "@/components/shared/pager";
import { initials, avatarColor } from "@/lib/avatar";
import type { AuditGroup } from "@/server/queries/audit";

const PAGE_SIZE = 6;

const TYPE_CHIPS = ["All", "Entries", "Members", "Config"] as const;

export function Audit({ groups: GROUPS, total }: { groups: AuditGroup[]; total: number }) {
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<string>("All");
  const [page, setPage] = useState(1);

  // Flatten filtered events (date carried along) so the pager works across groups.
  const flat = useMemo(() => {
    const s = q.trim().toLowerCase();
    return GROUPS.flatMap((g) =>
      g.items
        .filter(
          (e) =>
            (chip === "All" || e.type === chip) &&
            (!s || e.act.toLowerCase().includes(s) || e.who.toLowerCase().includes(s)),
        )
        .map((e) => ({ ...e, date: g.date })),
    );
  }, [q, chip, GROUPS]);

  // Reset to first page when the filter changes (adjust-state-during-render).
  const filterKey = `${q}|${chip}`;
  const [prevKey, setPrevKey] = useState(filterKey);
  if (filterKey !== prevKey) {
    setPrevKey(filterKey);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(flat.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = flat.slice(start, start + PAGE_SIZE);
  const rangeLabel = flat.length === 0 ? "Showing 0 of 0" : `Showing ${start + 1}–${start + visible.length} of ${flat.length}`;

  // Re-group the current page's slice by date, preserving order.
  const groups = useMemo(() => {
    const out: { date: string; items: typeof visible }[] = [];
    for (const e of visible) {
      const last = out[out.length - 1];
      if (last && last.date === e.date) last.items.push(e);
      else out.push({ date: e.date, items: [e] });
    }
    return out;
  }, [visible]);

  return (
    <div className="mx-auto max-w-320 p-4 pb-19.5 md:p-6.5 md:pb-6.5">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-13 font-semibold leading-none text-teal">
        ← Admin
      </Link>
      <div className="mb-4.5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">Audit log</h1>
          <p className="mt-1.75 text-13 font-medium leading-140 text-mut">
            A permanent record — every action, who did it, and when.
          </p>
        </div>
        <span className="font-mono text-xs font-semibold leading-none text-fnt">{total} events</span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2.25 rounded-11 border border-bd2 bg-sf px-3.25 py-2.75">
          <Search className="size-3.75 flex-none text-fnt" strokeWidth={2} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search actions or people…"
            className="min-w-0 flex-1 bg-transparent text-13 font-medium text-ink outline-none placeholder:text-fnt"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {TYPE_CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => setChip(c)}
              className={`rounded-lg border px-3 py-2.5 text-11 font-semibold leading-none ${
                chip === c ? "border-teal/40 bg-tlsf text-teal" : "border-bd2 bg-sf text-mut"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-card">
        {groups.map((g) => (
          <div key={g.date}>
            <div className="flex items-center gap-2.5 border-b border-hr2 bg-bg px-5 py-2.75">
              <span className="text-10 font-bold uppercase leading-none tracking-7 text-fnt">{g.date}</span>
              <span className="h-px flex-1 bg-hr2" />
            </div>
            {g.items.map((e, i) => {
              const { bg, fg } = avatarColor(e.who);
              return (
                <div key={i} className="flex items-center gap-3 border-b border-hr2 px-5 py-3.5 last:border-b-0">
                  <span className="flex size-9 flex-none items-center justify-center rounded-full text-xs font-bold" style={{ background: bg, color: fg }}>
                    {initials(e.who)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-13 font-semibold leading-145 text-ink">{e.act}</div>
                    <div className="mt-1 text-11 font-medium leading-130 text-fnt">{e.who}</div>
                  </div>
                  <span className="whitespace-nowrap font-mono text-11 font-medium leading-130 text-fnt">{e.when}</span>
                </div>
              );
            })}
          </div>
        ))}
        {groups.length === 0 && (
          <div className="px-5 py-13.5 text-center">
            <div className="text-15 font-bold leading-none text-ink">No matching events</div>
            <div className="mt-1.5 text-xs font-medium leading-140 text-mut">Try a different search or filter.</div>
          </div>
        )}
        {flat.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hr2 px-5 py-3.25">
            <span className="text-xs font-medium leading-none text-fnt">{rangeLabel}</span>
            <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
