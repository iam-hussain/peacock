import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { MEMBER_COLS, type Member } from "../data";
import { ListAvatar } from "./list-avatar";
import { SortArrow } from "./sort-arrow";

export const MEMBERS_GRID = "grid-cols-[1.6fr_1fr_1fr_1fr_1fr_1fr_1fr_0.8fr]";

/** The sortable members table — shared by the desktop page and the mobile "table" view. */
export function MembersTable({ members }: { members: Member[] }) {
  return (
    <>
      <div className={`grid ${MEMBERS_GRID} gap-3 border-b border-hair bg-sf2 px-5 py-[11px]`}>
        {MEMBER_COLS.map((c) => (
          <div
            key={c.key}
            className={`flex items-center gap-1 text-[10px] font-semibold uppercase leading-none tracking-[0.06em] text-fnt ${
              c.align === "right" ? "justify-end" : ""
            }`}
          >
            <span>{c.label}</span>
            <SortArrow sort={c.sort} />
          </div>
        ))}
      </div>
      {members.map((m) => (
        <Row key={m.id} m={m} />
      ))}
    </>
  );
}

function Row({ m }: { m: Member }) {
  return (
    <Link
      href={`/members/${m.id}`}
      className={`grid ${MEMBERS_GRID} items-center gap-3 border-b border-hr2 px-5 py-3 transition-colors last:border-b-0 hover:bg-sf2`}
    >
      <div className="flex items-center gap-[11px]">
        <ListAvatar name={m.name} size={32} />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold leading-none text-ink">{m.name}</div>
          <div className="mt-[3px] whitespace-nowrap text-[11px] font-medium leading-[1.3] text-fnt">Joined {m.joined}</div>
        </div>
      </div>
      <Cell v={m.deposits} />
      <Cell v={m.profit} cls="text-in" />
      <Cell v={m.value} />
      <Cell v={m.held ?? "—"} cls={m.held ? "text-teal" : "text-fnt"} />
      <Cell v={m.adjustment ?? "—"} cls={m.adjustment ? "text-wfg" : "text-fnt"} />
      <Cell v={m.pending ?? "—"} cls={m.pending ? "text-outfg" : "text-fnt"} />
      <div className="flex justify-end">
        <StatusBadge status={m.status} />
      </div>
    </Link>
  );
}

function Cell({ v, cls = "text-ink" }: { v: string; cls?: string }) {
  return <div className={`whitespace-nowrap text-right font-mono text-[13px] font-semibold leading-none ${cls}`}>{v}</div>;
}
