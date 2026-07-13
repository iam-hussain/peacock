"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { BrandLoader } from "@/components/shared/brand-loader";
import { Pager } from "@/components/shared/pager";
import { ViewToggle, type ListView } from "@/components/shared/view-toggle";
import { fetchJson, useDebounced } from "@/lib/use-page-query";
import type { TxnPageDTO } from "@/server/queries/transactions";
import { ChipMenu, type ChipOption } from "./chip-menu";
import { HeaderRow, Row, MobileCard, ROLE_DOT } from "./transaction-row";
import { SearchBox, Empty, Legend, AddEntryButton, ExportCsvButton } from "./transaction-toolbar";

const DATE_INPUT = "rounded-lg border border-bd2 bg-transparent px-2.5 py-2 text-xs font-semibold leading-none text-mut outline-none focus:border-teal";

const RANGE_OPTS: ChipOption[] = [
  { value: "This year", label: "This year" },
  { value: "Last 30 days", label: "Last 30 days" },
  { value: "Last 90 days", label: "Last 90 days" },
  { value: "All time", label: "All time" },
  { value: "Custom range", label: "Custom range" },
];
const SIZE_OPTS: ChipOption[] = [5, 10, 25, 50].map((n) => ({ value: String(n), label: `${n} / page` }));

const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

// Resolve the active range (preset or custom) to an inclusive [start, end] window of ISO dates —
// sent to the API, which filters and pages server-side (the browser never holds the full ledger).
function rangeWindow(range: string, from: string, to: string): { start?: string; end?: string } {
  switch (range) {
    case "Custom range": return { start: from || undefined, end: to || undefined };
    case "This year": return { start: `${new Date().getFullYear()}-01-01` };
    case "Last 30 days": return { start: isoDaysAgo(30) };
    case "Last 90 days": return { start: isoDaysAgo(90) };
    default: return {}; // All time
  }
}

export function Transactions() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("All types");
  const [party, setParty] = useState("Anyone");
  const [range, setRange] = useState("All time");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [size, setSize] = useState(25);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ListView>("table"); // mobile defaults to the columnar table view

  const dq = useDebounced(q.trim());
  const filterKey = `${dq}|${type}|${party}|${range}|${from}|${to}|${size}`;
  const [prevKey, setPrevKey] = useState(filterKey);
  if (filterKey !== prevKey) {
    setPrevKey(filterKey);
    setPage(1);
  }

  const { start: winStart, end: winEnd } = rangeWindow(range, from, to);
  const filterParams = new URLSearchParams();
  if (dq) filterParams.set("q", dq);
  if (type !== "All types") filterParams.set("type", type);
  if (party !== "Anyone") filterParams.set("party", party);
  if (winStart) filterParams.set("start", winStart);
  if (winEnd) filterParams.set("end", winEnd);
  const params = new URLSearchParams(filterParams);
  params.set("page", String(page));
  params.set("size", String(size));

  const { data, error } = useQuery({
    queryKey: ["transactions", params.toString()],
    queryFn: () => fetchJson<TxnPageDTO>(`/api/transactions?${params}`),
    placeholderData: keepPreviousData, // keep the last page on screen while the next loads
  });
  if (error) throw error;
  if (!data) return <BrandLoader />;

  const typeOpts: ChipOption[] = [
    { value: "All types", label: "All types" },
    ...data.typeOpts.map((w) => ({ value: w, label: w })),
  ];
  const partyOpts: ChipOption[] = [
    { value: "Anyone", label: "Anyone" },
    ...data.parties.map((p) => ({ value: p.name, label: p.name, dot: ROLE_DOT[p.role] })),
  ];

  const visible = data.rows;
  const pageCount = data.pageCount;
  const safePage = Math.min(page, pageCount);
  const startIdx = (safePage - 1) * size;
  const rangeLabel = data.total === 0 ? "Showing 0 of 0" : `${startIdx + 1}–${startIdx + visible.length} of ${data.total}`;

  const hasFilters = !!q || type !== "All types" || party !== "Anyone" || range !== "All time" || !!from || !!to;
  const clearFilters = () => {
    setQ("");
    setType("All types");
    setParty("Anyone");
    setRange("All time");
    setFrom("");
    setTo("");
  };

  const chips = (
    <>
      <ChipMenu label="Range" options={RANGE_OPTS} value={range} onChange={setRange} />
      {range === "Custom range" && (
        <div className="flex items-center gap-1.5">
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className={DATE_INPUT} />
          <span className="text-xs font-semibold text-fnt">→</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To date" className={DATE_INPUT} />
        </div>
      )}
      <ChipMenu label="Type" options={typeOpts} value={type} onChange={setType} />
      <ChipMenu label="Party" options={partyOpts} value={party} onChange={setParty} searchable align="right" />
      <ExportCsvButton query={filterParams.toString()} />
      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-2.25 text-xs font-semibold leading-none text-out transition-colors hover:bg-out/10"
        >
          Clear <X className="size-3.5" strokeWidth={2.5} />
        </button>
      )}
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
    <div className="mx-auto max-w-320 p-4 pb-19.5 md:p-6.5 md:pb-6.5">
      {/* Desktop */}
      <div className="hidden md:block">
        <div className="mb-4.5 flex items-center justify-between">
          <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">Transactions</h1>
          <AddEntryButton />
        </div>
        <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-card">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-hair px-4.5 py-3.75">
            <SearchBox q={q} setQ={setQ} />
            {chips}
          </div>
          <Legend />
          <HeaderRow />
          {visible.map((t) => (
            <Row key={t.id} t={t} />
          ))}
          {data.total === 0 && <Empty />}
          <div className="border-t border-hair px-5.5 py-3.25">{footer}</div>
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-13 font-medium leading-none text-mut">
            {data.total} of {data.all} entries
          </span>
          <ViewToggle value={view} onChange={setView} />
        </div>
        <SearchBox q={q} setQ={setQ} />
        {/* wrap (don't x-scroll): overflow-x-auto also clips overflow-y, hiding the chip dropdowns */}
        <div className="mt-3 flex flex-wrap gap-2">{chips}</div>
        <div className="mt-3 rounded-xl border border-hair bg-sf px-3 py-2.5">
          <Legend bare />
        </div>

        {view === "cards" ? (
          <div className="mt-3 flex flex-col gap-3">
            {visible.map((t) => (
              <MobileCard key={t.id} t={t} />
            ))}
            {data.total === 0 && (
              <div className="rounded-2xl border border-bd bg-sf">
                <Empty />
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-bd bg-sf">
            <div className="min-w-[1040px]">
              <HeaderRow />
              {visible.map((t) => (
                <Row key={t.id} t={t} />
              ))}
              {data.total === 0 && <Empty />}
            </div>
          </div>
        )}

        <div className="mt-3">{footer}</div>
      </div>
    </div>
  );
}
