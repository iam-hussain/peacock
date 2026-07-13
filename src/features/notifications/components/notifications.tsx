"use client";

import { useState, useTransition } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { loadActivity, markAllRead } from "@/lib/actions-client";
import { useIsAdmin } from "@/lib/admin";
import { ApprovalCard, AMT } from "./approval-card";
import { ACTIVITY_PAGE, type ActivityEvent, type NotificationsData } from "@/features/notifications/types";

const CHIPS = ["All", "Approvals", "Alerts", "Activity"] as const;

const DOT: Record<string, string> = { in: "bg-in", out: "bg-out", neutral: "bg-fnt" };

export function Notifications({ approvals, alerts, events, summary }: NotificationsData) {
  const isAdmin = useIsAdmin();
  const [chip, setChip] = useState<string>("All");
  const show = (k: string) => chip === "All" || chip === k;
  const showApprovals = isAdmin && approvals.length > 0;
  const chips = isAdmin ? CHIPS : CHIPS.filter((c) => c !== "Approvals");
  return (
    <div className="mx-auto max-w-320 p-4 pb-19.5 md:p-6.5 md:pb-6.5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">Notifications</h1>
          <p className="mt-1.75 text-13 font-medium leading-140 text-mut">
            {showApprovals ? `${approvals.length} approvals · ` : ""}{alerts.length} alerts need attention
          </p>
        </div>
        <MarkAllReadButton />
      </div>

      <div className="grid items-start gap-5.5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <div className="flex gap-2">
            {chips.map((c) => (
              <button
                key={c}
                onClick={() => setChip(c)}
                aria-pressed={chip === c}
                className={`rounded-lg border px-3 py-2 text-11 font-semibold leading-none ${
                  chip === c ? "border-teal/40 bg-tlsf text-teal" : "border-bd2 bg-sf text-mut"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {show("Approvals") && showApprovals && (
            <>
              <div className="mb-2.75 mt-5.5 flex items-center gap-2">
                <span className="text-11 font-bold uppercase leading-none tracking-7 text-wfg">Needs your action</span>
                <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-9 bg-out px-1.5 font-mono text-10 font-bold text-white">{approvals.length}</span>
              </div>
              <div className="flex flex-col gap-2.75">
                {approvals.map((a) => (
                  <ApprovalCard key={a.id} a={a} />
                ))}
              </div>
            </>
          )}

          {show("Alerts") && alerts.length > 0 && (
            <>
              <div className="mb-2.75 mt-5.5 text-11 font-bold uppercase leading-none tracking-7 text-fnt">Alerts</div>
              <div className="flex flex-col gap-2.25">
                {alerts.map((al) => (
                  <div key={al.title} className="flex items-start gap-3 rounded-13 border border-wbd bg-wbg px-3.75 py-3.5">
                    <TriangleAlert className="mt-px size-4.5 flex-none text-wfg" strokeWidth={2} />
                    <div className="min-w-0 flex-1">
                      <div className="text-13 font-semibold leading-135 text-ink">{al.title}</div>
                      <div className="mt-1.5 text-11 font-medium leading-135 text-wfg">{al.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {show("Activity") && events.length > 0 && <ActivitySection initial={events} />}
        </div>

        {/* sidebar */}
        <div className="flex flex-col gap-3.5 lg:sticky lg:top-5">
          <div className="rounded-2xl border border-bd bg-sf p-5 shadow-card">
            <div className="mb-2 text-11 font-bold uppercase leading-none tracking-6 text-fnt">At a glance</div>
            {summary.map((s) => (
              <div key={s.label} className="flex items-center justify-between border-b border-hr2 py-2.5 last:border-b-0">
                <span className="flex items-center gap-2.5">
                  <span className={`size-2.25 rounded-full ${s.color}`} />
                  <span className="text-13 font-medium leading-none text-mut">{s.label}</span>
                </span>
                <span className="font-mono text-base font-bold leading-none text-ink">{s.v}</span>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-tlsf p-4.5">
            <div className="mb-2.75 text-xs font-bold leading-none text-teal">How this inbox works</div>
            <div className="flex flex-col gap-2.5">
              {[
                { c: "bg-out", b: "Approvals", t: "need a sign-off — approve or reject." },
                { c: "bg-wfg", b: "Alerts", t: "are live warnings — they clear when resolved." },
                { c: "bg-teal", b: "Activity", t: "is a record of what happened." },
              ].map((x) => (
                <div key={x.b} className="flex items-start gap-2.5">
                  <span className={`mt-1.25 size-2 flex-none rounded-full ${x.c}`} />
                  <div className="text-11 font-medium leading-145 text-mut">
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

function MarkAllReadButton() {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => markAllRead().then(() => {}))}
      disabled={pending}
      className="flex items-center gap-1.75 whitespace-nowrap rounded-10 border border-bd2 px-3.5 py-2.5 text-xs font-semibold leading-none text-teal hover:bg-tlsf disabled:opacity-60"
    >
      <Check className="size-3.5" strokeWidth={2.2} /> Mark all read
    </button>
  );
}

function ActivitySection({ initial }: { initial: ActivityEvent[] }) {
  const [items, setItems] = useState(initial);
  const [done, setDone] = useState(initial.length < ACTIVITY_PAGE);
  const [pending, start] = useTransition();
  const loadMore = () =>
    start(async () => {
      const next = await loadActivity(items.length);
      setItems((cur) => [...cur, ...next]);
      if (next.length < ACTIVITY_PAGE) setDone(true);
    });
  return (
    <>
      <div className="mb-2.75 mt-5.5 text-11 font-bold uppercase leading-none tracking-7 text-fnt">Activity</div>
      <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-card">
        {items.map((n, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-hr2 px-4 py-3.5 last:border-b-0">
            <span className={`size-2.25 flex-none rounded-full ${DOT[n.dir]}`} />
            <div className="min-w-0 flex-1">
              <div className="text-13 font-semibold leading-135 text-ink">{n.title}</div>
              <div className="mt-1 text-11 font-medium leading-135 text-fnt">{n.sub} · {n.time}</div>
            </div>
            {n.amt && <div className={`font-mono text-sm font-bold leading-none ${AMT[n.dir]}`}>{n.amt}</div>}
          </div>
        ))}
      </div>
      {!done && (
        <button
          onClick={loadMore}
          disabled={pending}
          className="mt-3 w-full rounded-10 border border-bd2 py-2.5 text-xs font-semibold leading-none text-teal hover:bg-tlsf disabled:opacity-60"
        >
          {pending ? "Loading…" : "Load more"}
        </button>
      )}
    </>
  );
}

