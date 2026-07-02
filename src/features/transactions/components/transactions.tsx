"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Pager } from "@/components/shared/pager";
import { ViewToggle, type ListView } from "@/components/shared/view-toggle";
import { type Txn, type Role, type Dir } from "../data";
import { ChipMenu, type ChipOption } from "./chip-menu";

const DOT: Record<Dir, string> = { in: "bg-in", out: "bg-out", neutral: "bg-fnt" };
const AMT: Record<Dir, string> = { in: "text-in", out: "text-out", neutral: "text-ink" };
const ROLE_DOT: Record<Role, string> = { treasurer: "bg-teal", member: "bg-ink", vendor: "bg-wfg" };
const PILL: Record<Role, string> = { treasurer: "bg-tlsf text-teal", member: "bg-bg2 text-ink", vendor: "bg-wbg text-wfg" };

const GRID = "grid-cols-[1.4fr_2fr_0.9fr_0.9fr_1fr]";

const RANGE_OPTS: ChipOption[] = [
  { value: "This year", label: "This year" },
  { value: "Last 30 days", label: "Last 30 days" },
  { value: "Last 90 days", label: "Last 90 days" },
  { value: "All time", label: "All time" },
];
const SIZE_OPTS: ChipOption[] = [5, 10, 25, 50].map((n) => ({ value: String(n), label: `${n} / page` }));

export function Transactions({ ledger }: { ledger: Txn[] }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("All types");
  const [party, setParty] = useState("Anyone");
  const [range, setRange] = useState("This year");
  const [size, setSize] = useState(25);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ListView>("cards");

  const typeOpts = useMemo<ChipOption[]>(
    () => [
      { value: "All types", label: "All types" },
      ...[...new Set(ledger.map((t) => t.what))].map((w) => ({ value: w, label: w })),
    ],
    [ledger],
  );
  const partyOpts = useMemo<ChipOption[]>(
    () => [
      { value: "Anyone", label: "Anyone" },
      ...[...new Map(ledger.flatMap((t) => [t.from, t.to]).map((p) => [p.name, p])).values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({ value: p.name, label: p.name, dot: ROLE_DOT[p.role] })),
    ],
    [ledger],
  );

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return ledger.filter((t) => {
      if (type !== "All types" && t.what !== type) return false;
      if (party !== "Anyone" && t.from.name !== party && t.to.name !== party) return false;
      if (
        s &&
        !(
          t.what.toLowerCase().includes(s) ||
          t.from.name.toLowerCase().includes(s) ||
          t.to.name.toLowerCase().includes(s) ||
          t.amount.toLowerCase().includes(s)
        )
      )
        return false;
      return true;
    });
  }, [ledger, q, type, party]);

  const filterKey = `${q}|${type}|${party}|${size}`;
  const [prevKey, setPrevKey] = useState(filterKey);
  if (filterKey !== prevKey) {
    setPrevKey(filterKey);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * size;
  const visible = rows.slice(start, start + size);
  const rangeLabel = rows.length === 0 ? "Showing 0 of 0" : `${start + 1}–${start + visible.length} of ${rows.length}`;

  const chips = (
    <>
      <ChipMenu label="Range" options={RANGE_OPTS} value={range} onChange={setRange} />
      <ChipMenu label="Type" options={typeOpts} value={type} onChange={setType} />
      <ChipMenu label="Party" options={partyOpts} value={party} onChange={setParty} searchable align="right" />
    </>
  );
  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium leading-none text-fnt">{rangeLabel}</span>
        <ChipMenu label="Rows" options={SIZE_OPTS} value={String(size)} onChange={(v) => setSize(Number(v))} />
      </div>
      <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
    </div>
  );

  return (
    <div className="mx-auto max-w-[1280px] p-4 pb-[78px] md:p-[26px] md:pb-[26px]">
      {/* Desktop */}
      <div className="hidden md:block">
        <h1 className="mb-[18px] text-2xl font-bold leading-none tracking-[-0.02em] text-ink">Transactions</h1>
        <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-[0_1px_2px_var(--shadow)]">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-hair px-[18px] py-[15px]">
            <SearchBox q={q} setQ={setQ} />
            {chips}
          </div>
          <Legend />
          <div className={`grid ${GRID} gap-3 border-b border-hair bg-sf2 px-[22px] py-[11px]`}>
            {["Type", "From → To", "Date", "Method", "Amount"].map((h, i) => (
              <div key={h} className={`text-[10px] font-semibold uppercase leading-none tracking-[0.06em] text-fnt ${i === 4 ? "text-right" : ""}`}>
                {h}
              </div>
            ))}
          </div>
          {visible.map((t) => (
            <Row key={t.id} t={t} />
          ))}
          {rows.length === 0 && <Empty />}
          <div className="border-t border-hair px-[22px] py-[13px]">{footer}</div>
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium leading-none text-mut">
            {rows.length} of {ledger.length} entries
          </span>
          <ViewToggle value={view} onChange={setView} />
        </div>
        <SearchBox q={q} setQ={setQ} />
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{chips}</div>
        <div className="mt-3 rounded-xl border border-hair bg-sf px-3 py-2.5">
          <Legend bare />
        </div>

        {view === "cards" ? (
          <div className="mt-3 flex flex-col gap-3">
            {visible.map((t) => (
              <MobileCard key={t.id} t={t} />
            ))}
            {rows.length === 0 && (
              <div className="rounded-2xl border border-bd bg-sf">
                <Empty />
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-bd bg-sf">
            <div className="min-w-[720px]">
              <div className={`grid ${GRID} gap-3 border-b border-hair bg-sf2 px-[22px] py-[11px]`}>
                {["Type", "From → To", "Date", "Method", "Amount"].map((h, i) => (
                  <div key={h} className={`text-[10px] font-semibold uppercase leading-none tracking-[0.06em] text-fnt ${i === 4 ? "text-right" : ""}`}>
                    {h}
                  </div>
                ))}
              </div>
              {visible.map((t) => (
                <Row key={t.id} t={t} />
              ))}
              {rows.length === 0 && <Empty />}
            </div>
          </div>
        )}

        <div className="mt-3">{footer}</div>
      </div>
    </div>
  );
}

function SearchBox({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  return (
    <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-[10px] border border-bd2 px-3">
      <Search className="size-[15px] flex-none text-fnt" strokeWidth={2} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search member, type, amount…"
        className="min-w-0 flex-1 bg-transparent py-[11px] text-[13px] font-medium text-ink outline-none placeholder:text-fnt"
      />
    </div>
  );
}

function Empty() {
  return (
    <div className="px-4 py-[52px] text-center text-sm font-semibold text-ink">No transactions match these filters</div>
  );
}

function Legend({ bare = false }: { bare?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-[15px] ${bare ? "" : "border-b border-hair px-[22px] py-2.5"}`}>
      <span className="text-[10px] font-semibold uppercase leading-none tracking-[0.05em] text-fnt">Parties</span>
      <LegendItem dot="bg-teal" cls="text-teal" label="Treasurer" />
      <LegendItem dot="bg-ink" cls="text-ink" label="Member" />
      <LegendItem dot="bg-wfg" cls="text-wfg" label="Vendor / chit" />
    </div>
  );
}

function LegendItem({ dot, cls, label }: { dot: string; cls: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold leading-none ${cls}`}>
      <span className={`size-[7px] rounded-full ${dot}`} /> {label}
    </span>
  );
}

function PartyPill({ p, tinted = false }: { p: Txn["from"]; tinted?: boolean }) {
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold leading-none ${
        tinted ? PILL[p.role] : "bg-bg2 text-ink"
      }`}
    >
      <span className={`size-[6px] flex-none rounded-full ${ROLE_DOT[p.role]}`} />
      <span className="truncate">{p.name}</span>
    </span>
  );
}

/** Mobile card — matches the "card view": type + amount, tinted party pills + method, dates. */
function MobileCard({ t }: { t: Txn }) {
  return (
    <div className="rounded-2xl border border-bd bg-sf px-4 py-3.5">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-[9px]">
          <span className={`size-2 flex-none rounded-full ${DOT[t.dir]}`} />
          <span className="text-[15px] font-semibold leading-tight text-ink">{t.what}</span>
        </div>
        <span className={`flex-none font-mono text-[15px] font-semibold leading-none ${AMT[t.dir]}`}>{t.amount}</span>
      </div>
      <div className="flex flex-wrap items-center gap-[7px]">
        <PartyPill p={t.from} tinted />
        <span className="text-xs font-semibold text-fnt">→</span>
        <PartyPill p={t.to} tinted />
        <span className="text-[11px] font-medium leading-none text-fnt">· {t.method}</span>
      </div>
      <div className="mt-2.5 text-[11px] font-medium leading-none text-fnt">
        {t.date} · entered {t.entered}
      </div>
    </div>
  );
}

function Row({ t }: { t: Txn }) {
  return (
    <div className={`grid ${GRID} items-center gap-3 border-b border-hr2 px-[22px] py-[13px] last:border-b-0`}>
      <div className="flex items-center gap-[9px]">
        <span className={`size-2 flex-none rounded-full ${DOT[t.dir]}`} />
        <span className="text-[13px] font-semibold leading-none text-ink">{t.what}</span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-[7px]">
        <PartyPill p={t.from} />
        <span className="font-semibold text-fnt">→</span>
        <PartyPill p={t.to} />
      </div>
      <div>
        <div className="font-mono text-xs font-semibold leading-none text-ink">{t.date}</div>
        <div className="mt-1 text-[10px] font-medium leading-[1.2] text-fnt">Entered {t.entered}</div>
      </div>
      <div>
        <span className="rounded-md bg-bg2 px-[9px] py-[5px] text-[11px] font-semibold leading-none text-mut">{t.method}</span>
      </div>
      <div className={`text-right font-mono text-sm font-semibold leading-none ${AMT[t.dir]}`}>{t.amount}</div>
    </div>
  );
}
