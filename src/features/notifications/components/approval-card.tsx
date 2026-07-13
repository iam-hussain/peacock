"use client";

import { useState, useTransition } from "react";
import { initials } from "@/lib/avatar";
import { decideSubmission } from "@/lib/actions-client";
import type { NotificationsData } from "@/features/notifications/types";

export const AMT: Record<string, string> = { in: "text-in", out: "text-out", neutral: "text-mut" };

type Approval = NotificationsData["approvals"][number];

/** One pending member submission with Approve / Reject — shared by the notifications inbox and the
 *  dedicated /approvals queue. */
export function ApprovalCard({ a }: { a: Approval }) {
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
    <div className="rounded-14 border border-wbd bg-sf p-4 shadow-card">
      <div className="flex items-center gap-2.75">
        <span className="flex size-9 flex-none items-center justify-center rounded-10 bg-tlsf text-13 font-bold text-teal">
          {initials(a.who)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold leading-115 text-ink">{a.who}</div>
          <div className="mt-1.5 text-11 font-medium leading-135 text-fnt">{a.type} · {a.sub}</div>
        </div>
        <div className={`font-mono text-15 font-bold leading-none ${AMT[a.dir]}`}>{a.amt}</div>
      </div>
      <div className="mt-2.75 grid grid-cols-2 gap-x-5.5 gap-y-2.25 border-t border-wbd pt-2.75">
        {meta.map((m) => (
          <div key={m.l} className={m.wide ? "col-span-2" : ""}>
            <span className="text-9 font-semibold uppercase leading-none tracking-5 text-fnt">{m.l}</span>
            <div className={`mt-0.75 text-xs font-semibold leading-120 text-ink ${m.mono ? "font-mono" : ""}`}>{m.v}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2.25">
        <button
          onClick={() => decide("approve")}
          disabled={pending}
          className="flex-1 rounded-9 bg-teal p-2.75 text-center text-13 font-semibold leading-none text-white hover:opacity-90 disabled:opacity-60"
        >
          Approve
        </button>
        <button
          onClick={() => decide("reject")}
          disabled={pending}
          className="flex-1 rounded-9 border border-outbd bg-sf p-2.75 text-center text-13 font-semibold leading-none text-out hover:bg-outbg disabled:opacity-60"
        >
          Reject
        </button>
      </div>
      {err && <p className="mt-2 text-12 font-medium leading-140 text-out">{err}</p>}
    </div>
  );
}
