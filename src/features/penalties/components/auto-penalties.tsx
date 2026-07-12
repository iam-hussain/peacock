"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, ShieldAlert, Save, Users, CalendarDays } from "lucide-react";
import { Pager } from "@/components/shared/pager";
import { formAction, syncAutoPenaltiesNow, savePenaltyConfig } from "@/lib/actions-client";
import { initials } from "@/lib/avatar";
import { formatPaise } from "@/lib/money";
import { DEFAULT_PENALTY_STATE, PenaltyFields, type PenaltyState } from "@/features/settings/components/penalty-fields";
import type { AutoPenaltiesData, AutoPenaltyRow } from "@/server/queries/penalties";

export function AutoPenalties({ data, error }: { data?: AutoPenaltiesData; error?: string }) {
  if (error || !data) {
    return (
      <div className="mx-auto max-w-140 p-4 pb-19.5 md:p-6.5">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-bd bg-sf px-6 py-14 text-center shadow-card">
          <ShieldAlert className="size-8 text-fnt" strokeWidth={1.8} />
          <div className="text-15 font-bold leading-none text-ink">Auto penalties</div>
          <div className="text-13 font-medium leading-140 text-mut">{error ?? "Couldn't load auto penalties."}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-320 p-4 pb-19.5 md:p-6.5 md:pb-6.5">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-13 font-semibold leading-none text-teal">
        ← Admin
      </Link>
      <div className="mb-4.5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">Auto penalties</h1>
          <p className="mt-1.75 text-13 font-medium leading-140 text-mut">
            System-added deposit &amp; loan-interest penalties — each tagged with the month or loan it was charged for.
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-bold leading-none text-ink">{data.totalAssigned}</div>
          <div className="mt-1.5 text-11 font-medium leading-none text-fnt">{data.count} live penalt{data.count === 1 ? "y" : "ies"}</div>
        </div>
      </div>

      {/* Config + breakdown stack on the left; the long register gets the full right column. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-4">
          <ConfigEditor data={data} />
          <Breakdowns rows={data.rows ?? []} />
        </div>
        <Register rows={data.rows} enabled={data.enabled} />
      </div>
    </div>
  );
}

// The working enable/config panel — toggles + rates live right here, so an admin turns a penalty on
// without leaving the page. Reuses PenaltyFields (shared with the Edit-club form) + a focused save.
function ConfigEditor({ data }: { data: AutoPenaltiesData }) {
  const router = useRouter();
  const [pen, setPen] = useState<PenaltyState>(data.config ?? DEFAULT_PENALTY_STATE);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = () =>
    start(async () => {
      const res = await savePenaltyConfig({
        penaltyFrom: pen.from,
        depositPenaltyEnabled: pen.depositEnabled, depositPenaltyRate: pen.depositRate, depositPenaltyMin: pen.depositMin,
        interestPenaltyEnabled: pen.interestEnabled, interestPenaltyRate: pen.interestRate, interestPenaltyMin: pen.interestMin, interestPenaltyGrace: pen.interestGrace,
      });
      setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error ?? "Could not save." });
      if (res.ok) router.refresh();
    });

  const sync = () =>
    start(async () => {
      const res = await syncAutoPenaltiesNow();
      setMsg(res.ok ? { ok: true, text: res.added ? `Added ${res.added} new.` : "Up to date." } : { ok: false, text: res.error ?? "Sync failed." });
      if (res.ok) router.refresh();
    });

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-bd bg-sf p-4 shadow-card md:p-5">
      <div className="flex items-center justify-between">
        <div className="text-11 font-semibold uppercase leading-none tracking-4 text-fnt">Rules &amp; config</div>
        <button
          onClick={sync}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-bd2 px-3 py-2 text-11 font-semibold leading-none text-teal hover:bg-tlsf disabled:opacity-60"
        >
          <RefreshCw className={`size-3.5 ${pending ? "animate-spin" : ""}`} strokeWidth={2.2} /> Sync now
        </button>
      </div>

      <PenaltyFields value={pen} onChange={setPen} />

      <div className="flex items-center justify-between gap-3">
        <span className={`text-11 font-medium leading-none ${msg ? (msg.ok ? "text-teal" : "text-out") : "text-fnt"}`}>
          {msg?.text ?? "Changes apply from the date above — not retroactive."}
        </span>
        <button
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-11 bg-teal px-4 py-2.5 text-13 font-semibold leading-none text-white disabled:opacity-60"
        >
          <Save className="size-4" strokeWidth={2.2} /> Save
        </button>
      </div>
    </div>
  );
}

type TypeFilter = (typeof TYPE_FILTERS)[number][0];

/** All / Deposit / Interest segmented chips — shared by the Breakdown and Register cards. */
function TypeChips({ value, onChange }: { value: TypeFilter; onChange: (v: TypeFilter) => void }) {
  return (
    <div className="flex gap-1 rounded-10 bg-bg2 p-0.75">
      {TYPE_FILTERS.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-8 px-2.5 py-1.5 text-11 font-semibold leading-none transition-colors ${value === v ? "bg-sf text-teal shadow-sm" : "text-mut"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Breakdowns({ rows }: { rows: AutoPenaltyRow[] }) {
  const [view, setView] = useState<"member" | "month">("member");
  const [type, setType] = useState<TypeFilter>("all");
  const live = rows.filter((r) => !r.voided && (type === "all" || r.type === type));
  const agg = new Map<string, { label: string; count: number; total: number }>();
  for (const r of live) {
    const key = view === "member" ? r.memberId : r.monthKey;
    const g = agg.get(key) ?? { label: view === "member" ? r.member : r.monthLabel, count: 0, total: 0 };
    g.count++; g.total += r.amountPaise; agg.set(key, g);
  }
  const groups = [...agg.entries()]
    .sort((a, b) => (view === "member" ? b[1].total - a[1].total : a[0] < b[0] ? 1 : -1)) // biggest first / newest month first
    .map(([key, g]) => ({ key, label: g.label, count: g.count, total: formatPaise(BigInt(g.total)) }));
  return (
    <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-hr2 px-4 py-3">
        <span className="text-11 font-semibold uppercase leading-none tracking-4 text-fnt">Breakdown</span>
        <div className="flex flex-wrap items-center gap-2">
          <TypeChips value={type} onChange={setType} />
          <div className="flex gap-1 rounded-10 bg-bg2 p-0.75">
            <Seg on={view === "member"} onClick={() => setView("member")} icon={Users} label="By member" />
            <Seg on={view === "month"} onClick={() => setView("month")} icon={CalendarDays} label="By month" />
          </div>
        </div>
      </div>
      {groups.length === 0 ? (
        <div className="px-5 py-10 text-center text-12 font-medium leading-140 text-mut">No penalties to break down yet.</div>
      ) : (
        <div className="max-h-[280px] overflow-y-auto">
          {groups.map((g) => {
            const inner = (
              <>
                <span className={`flex size-8 flex-none items-center justify-center rounded-9 text-11 font-bold ${view === "member" ? "bg-tlsf text-teal" : "bg-nbg text-nfg"}`}>
                  {view === "member" ? initials(g.label) : g.label.slice(0, 3)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-13 font-bold leading-none text-ink">{g.label}</div>
                  <div className="mt-1.5 text-11 font-medium leading-none text-fnt">{g.count} penalt{g.count === 1 ? "y" : "ies"}</div>
                </div>
                <span className="whitespace-nowrap font-mono text-13 font-bold leading-none text-ink">{g.total}</span>
              </>
            );
            return view === "member" ? (
              <Link key={g.key} href={`/members/${g.key}`} className="flex items-center gap-3 border-b border-hr2 px-4 py-3 last:border-b-0 hover:bg-bg">
                {inner}
              </Link>
            ) : (
              <div key={g.key} className="flex items-center gap-3 border-b border-hr2 px-4 py-3 last:border-b-0">{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Seg({ on, onClick, icon: Icon, label }: { on: boolean; onClick: () => void; icon: typeof Users; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-8 px-2.5 py-1.5 text-11 font-semibold leading-none transition-colors ${on ? "bg-sf text-teal shadow-sm" : "text-mut"}`}
    >
      <Icon className="size-3.5" strokeWidth={2.2} /> {label}
    </button>
  );
}

const PAGE_SIZE = 10;
const TYPE_FILTERS = [["all", "All"], ["Deposit", "Deposit"], ["Loan interest", "Interest"]] as const;

function Register({ rows, enabled }: { rows: AutoPenaltyRow[]; enabled: boolean }) {
  const [page, setPage] = useState(1);
  const [type, setType] = useState<TypeFilter>("all");
  const filtered = type === "all" ? rows : rows.filter((r) => r.type === type);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  return (
    <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-card">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-hr2 bg-bg px-4 py-2.75">
        <span className="text-10 font-bold uppercase leading-none tracking-7 text-fnt">Register</span>
        <TypeChips value={type} onChange={(v) => { setType(v); setPage(1); }} />
        <span className="h-px flex-1 bg-hr2" />
        <span className="text-10 font-semibold leading-none text-fnt">
          {type === "all" ? `${rows.length} total` : `${filtered.length} of ${rows.length}`}
        </span>
      </div>
      {visible.map((r) => <Row key={r.id} row={r} />)}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hr2 px-4 py-3.25">
          <span className="text-xs font-medium leading-none text-fnt">
            Showing {start + 1}–{start + visible.length} of {filtered.length}
          </span>
          <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
        </div>
      )}
      {filtered.length === 0 && (
        <div className="px-5 py-12 text-center">
          <div className="text-15 font-bold leading-none text-ink">
            {rows.length === 0 ? "No auto penalties yet" : "No matching penalties"}
          </div>
          <div className="mt-1.5 text-xs font-medium leading-140 text-mut">
            {rows.length > 0 ? "Try a different type filter." : enabled ? "Nothing has crossed a penalty threshold." : "Turn a penalty on in the panel to start."}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ row }: { row: AutoPenaltyRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const dismiss = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("id", row.id);
      fd.set("memberId", row.memberId);
      const res = await formAction("deleteCharge", fd);
      if (res.ok) router.refresh();
    });

  return (
    <div className={`flex items-center gap-3 border-b border-hr2 px-4 py-3 last:border-b-0 ${row.voided ? "opacity-55" : ""}`}>
      <span className={`flex-none rounded-md px-2 py-1.5 text-9 font-bold uppercase leading-none tracking-3 ${row.type === "Deposit" ? "bg-tlsf text-teal" : "bg-nbg text-nfg"}`}>
        {row.type}
      </span>
      <div className="min-w-0 flex-1">
        <Link href={`/members/${row.memberId}`} className="text-13 font-bold leading-none text-ink hover:text-teal">{row.member}</Link>
        <div className="mt-1.5 truncate text-11 font-medium leading-none text-fnt">{row.reference} · {row.date}</div>
      </div>
      <span className={`whitespace-nowrap font-mono text-13 font-bold leading-none ${row.voided ? "text-fnt line-through" : "text-ink"}`}>{row.amount}</span>
      {row.voided ? (
        <span className="flex-none rounded-md bg-nbg px-2 py-1.5 text-9 font-bold uppercase leading-none tracking-3 text-nfg">Voided</span>
      ) : (
        <button onClick={dismiss} disabled={pending} className="flex-none rounded-lg border border-bd2 px-2.5 py-2 text-10 font-semibold leading-none text-mut hover:bg-bg2 disabled:opacity-60">
          Dismiss
        </button>
      )}
    </div>
  );
}
