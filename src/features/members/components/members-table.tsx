"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { MEMBER_COLS, type Member } from "../data";
import type { MemberSort } from "@/server/queries/members";
import { ListAvatar } from "./list-avatar";
import { SortArrow } from "./sort-arrow";

export const MEMBERS_GRID =
  "grid-cols-[minmax(10rem,1.6fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_minmax(8rem,1.4fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_minmax(5rem,0.8fr)]";

// Column key → the raw MemberSort field it sorts by.
const COL_SORT_KEY: Record<string, keyof MemberSort> = {
  member: "name",
  deposits: "deposits",
  profit: "profit",
  value: "value",
  held: "held",
  adjustment: "adjustment",
  pending: "pending",
  status: "status",
};

/** The sortable members table — shared by the desktop page and the mobile "table" view. */
export function MembersTable({ members }: { members: Member[] }) {
  const [sort, setSort] = useState<{ key: keyof MemberSort; dir: "asc" | "desc" } | null>(null);

  const rows = useMemo(() => {
    if (!sort) return members;
    const { key, dir } = sort;
    const sign = dir === "asc" ? 1 : -1;
    return [...members].sort((a, b) => {
      const av = a.sort?.[key];
      const bv = b.sort?.[key];
      if (typeof av === "string" || typeof bv === "string") return sign * String(av ?? "").localeCompare(String(bv ?? ""));
      return sign * ((av ?? 0) - (bv ?? 0));
    });
  }, [members, sort]);

  const toggle = (key: keyof MemberSort) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "name" ? "asc" : "desc" }));

  return (
    <>
      <div className={`grid ${MEMBERS_GRID} gap-3 border-b border-hair bg-sf2 px-5 py-2.75`}>
        {MEMBER_COLS.map((c) => {
          const key = COL_SORT_KEY[c.key];
          const sortable = c.sort !== "none";
          const active = sort?.key === key;
          const arrow = !sortable ? "none" : active ? (sort!.dir === "asc" ? "up" : "down") : "updown";
          const cls = `flex items-center gap-1 text-10 font-semibold uppercase leading-none tracking-6 text-fnt ${
            c.align === "right" ? "justify-end" : ""
          }`;
          return sortable ? (
            <button key={c.key} type="button" onClick={() => toggle(key)} className={`${cls} hover:text-ink`}>
              <span>{c.label}</span>
              <SortArrow sort={arrow} />
            </button>
          ) : (
            <div key={c.key} className={cls}>
              <span>{c.label}</span>
              <SortArrow sort={arrow} />
            </div>
          );
        })}
      </div>
      {rows.map((m) => (
        <Row key={m.id} m={m} />
      ))}
    </>
  );
}

function Row({ m }: { m: Member }) {
  return (
    <Link
      prefetch={false}
      href={`/members/${m.id}`}
      className={`grid ${MEMBERS_GRID} items-center gap-3 border-b border-hr2 px-5 py-3 transition-colors last:border-b-0 hover:bg-sf2`}
    >
      <div className="flex items-center gap-2.75">
        <ListAvatar name={m.name} src={m.avatarUrl} size={32} />
        <div className="min-w-0">
          <div className="text-13 font-semibold leading-none text-ink">{m.name}</div>
          <div className="mt-0.75 whitespace-nowrap text-11 font-medium leading-130 text-fnt">Joined {m.joined}</div>
        </div>
      </div>
      <Cell v={m.held ?? "—"} cls={m.held ? "text-teal" : "text-fnt"} />
      <Cell v={m.deposits} />
      <AdjustmentCell total={m.adjustmentCharged} pending={m.adjustment} />
      <Cell v={m.profit} cls="text-in" />
      <Cell v={m.value} />
      <Cell v={m.pending ?? "—"} cls={m.pending ? "text-outfg" : "text-fnt"} />
      <div className="flex justify-end">
        <StatusBadge status={m.status} />
      </div>
    </Link>
  );
}

function Cell({ v, cls = "text-ink" }: { v: string; cls?: string }) {
  return <div className={`whitespace-nowrap text-right font-mono text-13 font-semibold leading-none ${cls}`}>{v}</div>;
}

/** Adjustment = total catch-up/penalty ever charged (main), with the still-unpaid amount as sub-text. */
function AdjustmentCell({ total, pending }: { total: string | null; pending: string | null }) {
  if (!total) return <Cell v="—" cls="text-fnt" />;
  return (
    <div className="text-right">
      <div className="whitespace-nowrap font-mono text-13 font-semibold leading-none text-ink">{total}</div>
      <div className={`mt-1 whitespace-nowrap font-mono text-11 font-semibold leading-none ${pending ? "text-wfg" : "text-fnt"}`}>
        {pending ?? "₹0"} pending
      </div>
    </div>
  );
}
