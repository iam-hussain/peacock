import { CardShell } from "./card-shell";
import type { MemberDetailDTO as MemberDetail } from "@/server/queries/members";

// Inactive members: contribution figures are a closed record — struck through and dimmed.
const STRIKE = "line-through decoration-hair opacity-60";

export function ContributionCard({ m }: { m: MemberDetail }) {
  const closed = m.status !== "active";
  const strike = closed ? STRIKE : "";
  return (
    <CardShell
      title="Contribution & deposits"
      titleBadge={
        closed ? (
          <span className="inline-flex items-center gap-1.25 rounded-20 border border-wbd bg-wbg px-2.25 py-1.25 text-9 font-bold uppercase leading-none tracking-5 text-wfg">
            <span className="size-1.25 rounded-full bg-wfg" />
            Settled · closing record
          </span>
        ) : undefined
      }
      right={<span className="text-xs font-medium leading-none text-fnt">over {m.tenure}</span>}
    >
      <div className="my-4 grid grid-cols-2">
        <div className="border-r border-hr2 px-5.5">
          <div className="text-10 font-semibold uppercase leading-none tracking-5 text-fnt">Member deposits</div>
          <div className={`mt-2.75 font-mono text-28 font-semibold leading-none text-ink ${strike}`}>{m.depositsTotal}</div>
        </div>
        <div className="px-5.5">
          <div className="text-10 font-semibold uppercase leading-none tracking-5 text-fnt">
            Returns earned <span className="text-teal">· actual</span>
          </div>
          <div className={`mt-2.75 font-mono text-28 font-semibold leading-none text-in ${strike}`}>{m.returnsActual}</div>
          <div className="mt-2 text-11 font-medium leading-140 text-fnt">
            Full share if paid in full: <span className="font-semibold text-ink">{m.fullShare}</span> · paid{" "}
            {m.paidRatioPct}%
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 border-t border-hr2">
        <FourCell label="Periodic" value={m.periodic} strike={strike} />
        <FourCell label="Catch-up & Penalty" value={m.catchupPenalty} border strike={strike} />
        <FourCell label="Deposit due" value={m.depositPending ?? "₹0"} border accent={!!m.depositPending} strike={strike} />
        <FourCell label="Catch-up & Penalty due" value={m.adjustment ?? "₹0"} border accent={!!m.adjustment} strike={strike} />
      </div>
    </CardShell>
  );
}

function FourCell({ label, value, border = false, accent = false, strike = "" }: { label: string; value: string; border?: boolean; accent?: boolean; strike?: string }) {
  return (
    <div className={`px-5.5 py-3.75 ${border ? "border-l border-hr2" : ""}`}>
      <div className="text-11 font-medium leading-none text-mut">{label}</div>
      <div className={`mt-2 font-mono text-sm font-semibold leading-none ${accent ? "text-outfg" : "text-ink"} ${strike}`}>
        {value}
      </div>
    </div>
  );
}
