import type { Dir } from "../data";
import type { Party } from "@/server/queries/transactions";

const DOT: Record<Dir, string> = { in: "bg-in", out: "bg-out", neutral: "bg-fnt" };
const AMT: Record<Dir, string> = { in: "text-in", out: "text-out", neutral: "text-mut" };
// Party role palette — matches the Transactions page legend.
const ROLE_TEXT: Record<Party["role"], string> = { treasurer: "text-teal", member: "text-ink", vendor: "text-wfg" };

export function ActivityRow({
  from,
  to,
  what,
  date,
  time,
  amt,
  dir,
  compact = false,
}: {
  from: Party;
  to: Party;
  what: string;
  date: string;
  time: string;
  amt: string;
  dir: Dir;
  compact?: boolean;
}) {
  const when = [date, time].filter(Boolean).join(" · created ");
  return (
    <div className={`flex items-center gap-2.75 border-t border-hair ${compact ? "gap-2.25 py-2.5" : "py-2.75"}`}>
      <span className={`flex-none rounded-full ${DOT[dir]} ${compact ? "size-1.75" : "size-2"}`} />
      <div className="min-w-0 flex-1">
        <div className={`flex items-center gap-1 truncate font-semibold leading-none ${compact ? "text-13" : "text-13"}`}>
          <span className={`truncate ${ROLE_TEXT[from.role]}`}>{from.name}</span>
          <span className="flex-none text-mut">→</span>
          <span className={`truncate ${ROLE_TEXT[to.role]}`}>{to.name}</span>
        </div>
        <div className={`mt-1 font-medium leading-130 text-fnt ${compact ? "text-11" : "text-11"}`}>
          {when ? `${what} · ${when}` : what}
        </div>
      </div>
      <div className={`font-mono font-semibold leading-none ${AMT[dir]} ${compact ? "text-13" : "text-13"}`}>
        {amt}
      </div>
    </div>
  );
}
