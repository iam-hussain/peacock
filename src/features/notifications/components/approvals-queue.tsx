"use client";

import { Inbox, ShieldAlert } from "lucide-react";
import { useIsAdmin } from "@/lib/admin";
import { ApprovalCard } from "./approval-card";
import type { NotificationsData } from "@/features/notifications/types";

/** The dedicated admin review queue (/approvals): every pending member submission in one place,
 *  instead of scrolling the notifications bell. */
export function ApprovalsQueue({ approvals }: { approvals: NotificationsData["approvals"] }) {
  const isAdmin = useIsAdmin();
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-140 p-4 pb-19.5 md:p-6.5">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-bd bg-sf px-6 py-14 text-center shadow-card">
          <ShieldAlert className="size-8 text-fnt" strokeWidth={1.8} />
          <div className="text-15 font-bold leading-none text-ink">Approvals</div>
          <div className="text-13 font-medium leading-140 text-mut">Only club admins review submissions.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-160 p-4 pb-19.5 md:p-6.5 md:pb-6.5">
      <div className="mb-5">
        <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">Pending approvals</h1>
        <p className="mt-1.75 text-13 font-medium leading-140 text-mut">
          {approvals.length === 0
            ? "Nothing waiting — member submissions land here for sign-off."
            : `${approvals.length} submission${approvals.length === 1 ? "" : "s"} awaiting your sign-off.`}
        </p>
      </div>
      {approvals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-bd bg-sf px-6 py-14 text-center shadow-card">
          <Inbox className="size-8 text-fnt" strokeWidth={1.8} />
          <div className="text-13 font-medium leading-140 text-mut">All caught up.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.75">
          {approvals.map((a) => (
            <ApprovalCard key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}
