"use client";

import { useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/shared/modal";
import { type LoanEligibility, type LoanPriority } from "../data";

const PRIORITY_CHIP: Record<LoanPriority, string> = {
  High: "text-teal",
  Medium: "text-mut",
  Low: "text-fnt",
};

/** "Who can borrow next" — a compact bar (title + eligible count); "View" opens the full list in
 * a modal with each member's next-loan eligibility + priority hint (PRODUCT.md §8). */
export function EligibilityPanel({ members }: { members: LoanEligibility[] }) {
  const [open, setOpen] = useState(false);
  if (members.length === 0) return null;
  const eligibleCount = members.filter((m) => m.eligible).length;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-bd bg-sf px-4.5 py-3.5 shadow-card">
      <span className="text-13 font-bold leading-none text-ink">Who can borrow next</span>
      <div className="flex items-center gap-3">
        <span className="text-11 font-medium leading-none text-fnt">{eligibleCount} eligible · priority is a hint</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-8 border border-bd2 bg-sf px-3.5 py-2 text-12 font-semibold leading-none text-teal hover:bg-sf2"
        >
          View
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Who can borrow next" subtitle="Priority is a hint — the admin decides who actually borrows.">
        <div className="flex flex-col">
          {members.map((m) => (
            <Link
              key={m.memberId}
              prefetch={false}
              href={`/members/${m.memberId}`}
              className="flex items-center gap-2.5 border-b border-hr2 py-2.5 leading-none last:border-b-0 hover:opacity-70"
            >
              <span className={`size-[8px] flex-none rounded-full ${m.eligible ? "bg-teal" : "bg-bd2"}`} />
              <span className="min-w-0 flex-1 truncate text-13 font-semibold text-ink">{m.member}</span>
              <span className={`flex-none text-9 font-bold uppercase tracking-4 ${PRIORITY_CHIP[m.priority]}`}>{m.priority}</span>
              <span className={`flex-none whitespace-nowrap text-right text-11 font-medium ${m.eligible ? "text-teal" : "text-fnt"}`}>
                {m.eligible ? "Eligible" : m.reason}
              </span>
            </Link>
          ))}
        </div>
      </Modal>
    </div>
  );
}
