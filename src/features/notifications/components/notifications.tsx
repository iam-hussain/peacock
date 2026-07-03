"use client";

import { useState, useTransition } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { initials } from "@/lib/avatar";
import { decideSubmission, markAllRead } from "@/server/actions";
import { useIsAdmin } from "@/lib/admin";
import type { NotificationsData } from "@/server/queries/notifications";

const CHIPS = ["All", "Approvals", "Alerts", "Activity"] as const;

const AMT: Record<string, string> = { in: "text-in", out: "text-out", neutral: "text-mut" };
const DOT: Record<string, string> = { in: "bg-in", out: "bg-out", neutral: "bg-fnt" };

type Approval = NotificationsData["approvals"][number];

export function Notifications({ approvals, alerts, events, summary }: NotificationsData) {
  const [chip, setChip] = useState<string>("All");
  const show = (k: string) => chip === "All" || chip === k;
  return (
    <div className="mx-auto max-w-[1280px] p-4 pb-[78px] md:p-[26px] md:pb-[26px]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">Notifications</h1>
          <p className="mt-[7px] text-[13px] font-medium leading-[1.4] text-mut">{approvals.length} approvals · {alerts.length} alerts need attention</p>
        </div>
        <MarkAllReadButton />
      </div>

      <div className="grid items-start gap-[22px] lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <div className="flex gap-2">
            {CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => setChip(c)}
                className={`rounded-lg border px-3 py-2 text-[11px] font-semibold leading-none ${
                  chip === c ? "border-teal/40 bg-tlsf text-teal" : "border-bd2 bg-sf text-mut"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {show("Approvals") && (
            <>
              <div className="mb-[11px] mt-[22px] flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase leading-none tracking-[0.07em] text-wfg">Needs your action</span>
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-out px-1.5 font-mono text-[10px] font-bold text-white">{approvals.length}</span>
              </div>
              {approvals.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="flex flex-col gap-[11px]">
                  {approvals.map((a) => (
                    <ApprovalCard key={a.id} a={a} />
                  ))}
                </div>
              )}
            </>
          )}

          {show("Alerts") && (
            <>
              <div className="mb-[11px] mt-[22px] text-[11px] font-bold uppercase leading-none tracking-[0.07em] text-fnt">Alerts</div>
              {alerts.length === 0 ? (
                <EmptyState />
              ) : (
              <div className="flex flex-col gap-[9px]">
                {alerts.map((al) => (
                  <div key={al.title} className="flex items-start gap-3 rounded-[13px] border border-wbd bg-wbg px-[15px] py-3.5">
                    <TriangleAlert className="mt-px size-[18px] flex-none text-wfg" strokeWidth={2} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold leading-[1.35] text-ink">{al.title}</div>
                      <div className="mt-1.5 text-[11px] font-medium leading-[1.35] text-wfg">{al.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </>
          )}

          {show("Activity") && (
            <>
              <div className="mb-[11px] mt-[22px] text-[11px] font-bold uppercase leading-none tracking-[0.07em] text-fnt">Activity</div>
              {events.length === 0 ? (
                <EmptyState />
              ) : (
              <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-[0_1px_2px_var(--shadow)]">
                {events.map((n) => (
                  <div key={n.title} className="flex items-center gap-3 border-b border-hr2 px-4 py-3.5 last:border-b-0">
                    <span className={`size-[9px] flex-none rounded-full ${DOT[n.dir]}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold leading-[1.35] text-ink">{n.title}</div>
                      <div className="mt-1 text-[11px] font-medium leading-[1.35] text-fnt">{n.sub} · {n.time}</div>
                    </div>
                    {n.amt && <div className={`font-mono text-sm font-bold leading-none ${AMT[n.dir]}`}>{n.amt}</div>}
                  </div>
                ))}
              </div>
              )}
            </>
          )}
        </div>

        {/* sidebar */}
        <div className="flex flex-col gap-3.5 lg:sticky lg:top-5">
          <div className="rounded-2xl border border-bd bg-sf p-5 shadow-[0_1px_2px_var(--shadow)]">
            <div className="mb-2 text-[11px] font-bold uppercase leading-none tracking-[0.06em] text-fnt">At a glance</div>
            {summary.map((s) => (
              <div key={s.label} className="flex items-center justify-between border-b border-hr2 py-2.5 last:border-b-0">
                <span className="flex items-center gap-2.5">
                  <span className={`size-[9px] rounded-full ${s.color}`} />
                  <span className="text-[13px] font-medium leading-none text-mut">{s.label}</span>
                </span>
                <span className="font-mono text-base font-bold leading-none text-ink">{s.v}</span>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-tlsf p-[18px]">
            <div className="mb-[11px] text-xs font-bold leading-none text-teal">How this inbox works</div>
            <div className="flex flex-col gap-2.5">
              {[
                { c: "bg-out", b: "Approvals", t: "need a sign-off — approve or reject." },
                { c: "bg-wfg", b: "Alerts", t: "are live warnings — they clear when resolved." },
                { c: "bg-teal", b: "Activity", t: "is a record of what happened." },
              ].map((x) => (
                <div key={x.b} className="flex items-start gap-2.5">
                  <span className={`mt-[5px] size-2 flex-none rounded-full ${x.c}`} />
                  <div className="text-[11px] font-medium leading-[1.45] text-mut">
                    <b className="text-ink">{x.b}</b> {x.t}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span className="flex size-[58px] items-center justify-center rounded-full bg-tlsf">
        <Check className="size-6 text-teal" strokeWidth={2.2} />
      </span>
      <div className="mt-3.5 text-base font-bold leading-none text-ink">You&apos;re all caught up</div>
      <div className="mt-2 text-xs font-medium leading-[1.4] text-mut">Nothing needs your attention here.</div>
    </div>
  );
}

function MarkAllReadButton() {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => markAllRead().then(() => {}))}
      disabled={pending}
      className="flex items-center gap-[7px] whitespace-nowrap rounded-[10px] border border-bd2 px-3.5 py-2.5 text-xs font-semibold leading-none text-teal hover:bg-tlsf disabled:opacity-60"
    >
      <Check className="size-3.5" strokeWidth={2.2} /> Mark all read
    </button>
  );
}

function ApprovalCard({ a }: { a: Approval }) {
  const isAdmin = useIsAdmin();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const decide = (decision: "approve" | "reject") =>
    start(async () => {
      const res = await decideSubmission(a.id, decision);
      if (!res.ok) setErr(res.error ?? "Something went wrong.");
    });
  const meta = [
    { l: "Created by", v: a.creator },
    { l: "Treasurer", v: a.treasurer },
    { l: "Method", v: a.method },
    { l: "Transaction date", v: a.txn, mono: true },
    { l: "Date created", v: a.created, mono: true, wide: true },
  ];
  return (
    <div className="rounded-[14px] border border-wbd bg-sf p-4 shadow-[0_1px_2px_var(--shadow)]">
      <div className="flex items-center gap-[11px]">
        <span className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-tlsf text-[13px] font-bold text-teal">
          {initials(a.who)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold leading-[1.15] text-ink">{a.who}</div>
          <div className="mt-1.5 text-[11px] font-medium leading-[1.35] text-fnt">{a.type} · {a.sub}</div>
        </div>
        <div className={`font-mono text-[15px] font-bold leading-none ${AMT[a.dir]}`}>{a.amt}</div>
      </div>
      <div className="mt-[11px] grid grid-cols-2 gap-x-[22px] gap-y-[9px] border-t border-wbd pt-[11px]">
        {meta.map((m) => (
          <div key={m.l} className={m.wide ? "col-span-2" : ""}>
            <span className="text-[9px] font-semibold uppercase leading-none tracking-[0.05em] text-fnt">{m.l}</span>
            <div className={`mt-[3px] text-xs font-semibold leading-[1.2] text-ink ${m.mono ? "font-mono" : ""}`}>{m.v}</div>
          </div>
        ))}
      </div>
      {isAdmin && (
        <div className="mt-3 flex gap-[9px]">
          <button
            onClick={() => decide("approve")}
            disabled={pending}
            className="flex-1 rounded-[9px] bg-teal p-[11px] text-center text-[13px] font-semibold leading-none text-white hover:opacity-90 disabled:opacity-60"
          >
            Approve
          </button>
          <button
            onClick={() => decide("reject")}
            disabled={pending}
            className="flex-1 rounded-[9px] border border-outbd bg-sf p-[11px] text-center text-[13px] font-semibold leading-none text-out hover:bg-outbg disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      )}
      {err && <p className="mt-2 text-[12px] font-medium leading-[1.4] text-out">{err}</p>}
    </div>
  );
}
