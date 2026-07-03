import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Member } from "../data";
import { ListAvatar } from "./list-avatar";

/** Rich mobile member card: identity + Deposits/Profit/Value + status chips. */
export function MemberCard({ m }: { m: Member }) {
  const chips = [
    m.held ? { label: "Cash held", v: m.held, cls: "bg-tlsf text-teal" } : null,
    m.adjustment ? { label: "Adjustment", v: m.adjustment, cls: "bg-wbg text-wfg" } : null,
    m.pending ? { label: "Pending", v: m.pending, cls: "bg-outbg text-outfg" } : null,
  ].filter((c): c is { label: string; v: string; cls: string } => c !== null);

  return (
    <Link href={`/members/${m.id}`} className="block rounded-2xl border border-bd bg-sf p-4 active:bg-sf2">
      <div className="flex items-center gap-3">
        <ListAvatar name={m.name} size={44} />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold leading-tight text-ink">{m.name}</div>
          <div className="mt-1 text-[11px] font-medium leading-none text-fnt">Joined {m.joined}</div>
        </div>
        <StatusBadge status={m.status} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-hr2 pt-3">
        <Metric label="Deposits" v={m.deposits} />
        <Metric label="Profit" v={m.profit} cls="text-in" />
        <Metric label="Value" v={m.value} />
      </div>

      {chips.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {chips.map((c) => (
            <span
              key={c.label}
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold uppercase leading-none tracking-[0.04em] ${c.cls}`}
            >
              {c.label} <span className="font-mono">{c.v}</span>
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

function Metric({ label, v, cls = "text-ink" }: { label: string; v: string; cls?: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase leading-none tracking-[0.05em] text-fnt">{label}</div>
      <div className={`mt-1.5 font-mono text-[15px] font-semibold leading-none ${cls}`}>{v}</div>
    </div>
  );
}
