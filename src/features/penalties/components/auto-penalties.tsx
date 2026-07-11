"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { formAction, syncAutoPenaltiesNow } from "@/lib/actions-client";
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
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1.5 text-13 font-semibold leading-none text-teal">
        ← Admin tools
      </Link>
      <div className="mb-4.5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">Auto penalties</h1>
          <p className="mt-1.75 text-13 font-medium leading-140 text-mut">
            Penalties the system added automatically — each with the deposit month or loan it was charged for.
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-bold leading-none text-ink">{data.totalAssigned}</div>
          <div className="mt-1.5 text-11 font-medium leading-none text-fnt">{data.count} live penalt{data.count === 1 ? "y" : "ies"}</div>
        </div>
      </div>

      <ConfigCard data={data} />
      <RegisterCard rows={data.rows} enabled={data.enabled} />
    </div>
  );
}

function ConfigCard({ data }: { data: AutoPenaltiesData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const sync = () =>
    start(async () => {
      const res = await syncAutoPenaltiesNow();
      setMsg(res.ok ? (res.added ? `Added ${res.added} new penalt${res.added === 1 ? "y" : "ies"}.` : "Up to date — nothing new.") : res.error ?? "Sync failed.");
      if (res.ok) router.refresh();
    });

  const rule = (on: boolean, title: string, detail: string) => (
    <div className="flex items-start justify-between gap-3 border-t border-hr2 px-5 py-3.5 first:border-t-0">
      <div className="min-w-0">
        <div className="text-sm font-bold leading-none text-ink">{title}</div>
        <div className="mt-1.5 text-11 font-medium leading-tight text-fnt">{detail}</div>
      </div>
      <span className={`flex-none rounded-20 px-2.5 py-1.5 text-10 font-bold leading-none ${on ? "bg-tlsf text-teal" : "bg-nbg text-nfg"}`}>{on ? "On" : "Off"}</span>
    </div>
  );

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-bd bg-sf shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hr2 px-5 py-3.5">
        <div>
          <div className="text-11 font-semibold uppercase leading-none tracking-4 text-fnt">Rules</div>
          <div className="mt-1.5 text-11 font-medium leading-none text-fnt">Applying from {data.effectiveFrom}</div>
        </div>
        <div className="flex items-center gap-2.5">
          {msg && <span className="text-11 font-medium leading-none text-mut">{msg}</span>}
          <button
            onClick={sync}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-bd2 px-3 py-2.5 text-11 font-semibold leading-none text-teal hover:bg-tlsf disabled:opacity-60"
          >
            <RefreshCw className={`size-3.5 ${pending ? "animate-spin" : ""}`} strokeWidth={2.2} /> Sync now
          </button>
          <Link href="/settings" className="rounded-lg border border-bd2 px-3 py-2.5 text-11 font-semibold leading-none text-mut hover:bg-bg2">Change</Link>
        </div>
      </div>
      {rule(data.deposit.enabled, "Deposit penalty", `${data.deposit.rate} / mo on deposit pending over ${data.deposit.min}, on the 1st of each month`)}
      {rule(data.interest.enabled, "Loan-interest penalty", `${data.interest.rate} / mo on interest over ${data.interest.min}, every ${data.interest.grace} after a loan closes`)}
    </div>
  );
}

function RegisterCard({ rows, enabled }: { rows: AutoPenaltyRow[]; enabled: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-card">
      <div className="flex items-center gap-2.5 border-b border-hr2 bg-bg px-5 py-2.75">
        <span className="text-10 font-bold uppercase leading-none tracking-7 text-fnt">Register</span>
        <span className="h-px flex-1 bg-hr2" />
      </div>
      {rows.map((r) => <Row key={r.id} row={r} />)}
      {rows.length === 0 && (
        <div className="px-5 py-13.5 text-center">
          <div className="text-15 font-bold leading-none text-ink">No auto penalties yet</div>
          <div className="mt-1.5 text-xs font-medium leading-140 text-mut">
            {enabled ? "Nothing has crossed a penalty threshold." : "Auto penalties are off — turn them on in Settings → Club."}
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
    <div className={`flex items-center gap-3 border-b border-hr2 px-5 py-3.5 last:border-b-0 ${row.voided ? "opacity-55" : ""}`}>
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
