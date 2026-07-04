"use client";

import { AdminOnly } from "@/lib/admin";
import { RejoinDialog } from "./rejoin-modal";
import type { MemberDetailDTO as MemberDetail } from "@/server/queries/members";

// Dark "quote" card shown for inactive members: what they must settle to rejoin (PRODUCT.md §12).
export function RejoinCard({ m }: { m: MemberDetail }) {
  const r = m.rejoin!;
  return (
    <div className="rounded-18 border border-white/[0.08] bg-ink-surface p-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.28)] md:p-5.5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-20 bg-white/[0.13] px-2.75 py-1.25">
            <span className="size-1.5 rounded-full bg-gold" />
            <span className="text-10 font-bold uppercase leading-none tracking-7">Inactive member</span>
          </div>
          <div className="text-lg font-bold leading-120">Amount to rejoin the club</div>
          <div className="mt-1.75 max-w-[320px] text-xs font-medium leading-150 text-white/[0.66]">
            What {m.name}{" "}must settle to become an equal, active member again — backdated to the club&apos;s start.
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-10 font-medium uppercase leading-none tracking-6 text-white/[0.55]">Total</div>
          <div className="mt-2.25 font-mono text-[31px] font-bold leading-none">{r.total}</div>
        </div>
      </div>
      <div className="mt-4.5 grid grid-cols-2 gap-3">
        <div className="rounded-13 border border-hair-on-dark bg-fill-on-dark px-4 py-3.5">
          <div className="text-11 font-semibold leading-130 text-white/85">
            Monthly deposits
            <br />
            since club start
          </div>
          <div className="mt-2.75 font-mono text-19 font-bold leading-none">{r.depDue}</div>
          <div className="mt-2 text-10 font-medium leading-145 text-white/50">
            Full monthly deposit owed from the club&apos;s start
          </div>
        </div>
        <div className="rounded-13 border border-hair-on-dark bg-fill-on-dark px-4 py-3.5">
          <div className="text-11 font-semibold leading-130 text-white/85">
            Catch-up
            <br />
            per-member profit
          </div>
          <div className="mt-2.75 font-mono text-19 font-bold leading-none">{r.profit}</div>
          <div className="mt-2 text-10 font-medium leading-145 text-white/50">
            Equal share of profit each active member holds
          </div>
        </div>
      </div>
      <AdminOnly>
        <RejoinDialog
          memberId={m.id}
          memberName={m.name}
          rejoin={r}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-11 bg-white p-3.25 text-13 font-semibold leading-none text-ink-surface hover:opacity-90"
        >
          Record rejoin &amp; catch-up
        </RejoinDialog>
      </AdminOnly>
    </div>
  );
}
