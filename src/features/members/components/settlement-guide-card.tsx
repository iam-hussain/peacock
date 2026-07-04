import { CardShell } from "./card-shell";
import type { MemberDetailDTO as MemberDetail } from "@/server/queries/members";

function GuideRow({ label, value, tone }: { label: string; value: string; tone?: "in" | "out" }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-13 font-medium leading-none text-mut">{label}</span>
      <span className={`font-mono text-sm font-semibold leading-none ${tone === "in" ? "text-in" : tone === "out" ? "text-out" : "text-ink"}`}>{value}</span>
    </div>
  );
}

// Closed stint (§12): the frozen settlement guide — what the leave screen showed and what was paid.
export function SettlementGuideCard({ m }: { m: MemberDetail }) {
  const g = m.settledGuide!;
  return (
    <CardShell
      title="Settlement guide"
      titleBadge={
        <span className="inline-flex items-center gap-1.25 rounded-20 border border-wbd bg-wbg px-2.25 py-1.25 text-9 font-bold uppercase leading-none tracking-5 text-wfg">
          <span className="size-1.25 rounded-full bg-wfg" />
          Settled · {g.date}
        </span>
      }
    >
      <div className="px-5.5 py-4">
        <GuideRow label="Paid-in capital" value={g.capital} />
        <GuideRow label="Profit share" value={`+ ${g.profit}`} tone="in" />
        {g.owes && (
          <>
            <GuideRow label="Loan cleared" value={`− ${g.loan}`} tone="out" />
            <GuideRow label="Interest cleared" value={`− ${g.interest}`} tone="out" />
          </>
        )}
        <div className="mt-1 flex items-center justify-between border-t border-hr2 pt-2.5">
          <span className="text-13 font-bold leading-none text-ink">Amount paid out</span>
          <span className="font-mono text-17 font-bold leading-none text-ink">{g.paid}</span>
        </div>
      </div>
    </CardShell>
  );
}
