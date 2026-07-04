"use client";

import { useInPoster } from "@/lib/poster";
import type { MemberDetailDTO as MemberDetail } from "@/server/queries/members";

export function BalancesCard({ m }: { m: MemberDetail }) {
  const inPoster = useInPoster();
  const rows = [
    { l: "Pending dues", v: m.overallPending ?? "₹0", cls: m.overallPending ? "text-outfg" : "text-ink" },
    { l: "Loan taken", v: m.loanTaken, cls: "text-ink" },
    { l: "Interest due", v: m.interestDue, cls: m.interestDue !== "₹0" ? "text-wfg" : "text-ink" },
  ];
  return (
    <div className="rounded-18 border border-bd bg-sf px-5 pb-3.5 shadow-card">
      <div className={`pb-1 pt-3.5 font-semibold uppercase leading-none tracking-8 text-fnt ${inPoster ? "text-13" : "text-10"}`}>
        Overall Balances
      </div>
      {rows.map((r) => (
        <div key={r.l} className={`flex items-center justify-between border-t border-hr2 ${inPoster ? "py-4.5" : "py-3.25"}`}>
          <span className={`font-medium leading-none text-mut ${inPoster ? "text-[16px]" : "text-13"}`}>{r.l}</span>
          <span className={`font-mono font-bold leading-none ${r.cls} ${inPoster ? "text-26" : "text-17"}`}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}
