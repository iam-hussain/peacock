"use client";

import { useMemo, useState } from "react";
import type { Member } from "../data";
import { filterMembers, type MemberFilter } from "../filter";
import { MembersTable } from "./members-table";
import { MemberStatusFilter } from "./member-status-filter";

/** Desktop members card: live search + status filter over the table. */
export function MembersBrowser({ members }: { members: Member[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemberFilter>("active");

  const rows = useMemo(() => filterMembers(members, query, filter), [members, query, filter]);

  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-hair px-5 py-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members…"
          className="flex-1 rounded-10 border border-bd2 bg-transparent px-3.25 py-2.5 text-13 font-medium leading-none text-ink outline-none placeholder:text-fnt focus:border-teal"
        />
        <MemberStatusFilter value={filter} onChange={setFilter} />
      </div>

      {rows.length ? (
        <div className="overflow-x-auto">
          <MembersTable members={rows} />
        </div>
      ) : (
        <div className="px-5 py-14 text-center text-13 font-medium text-fnt">No members match.</div>
      )}
    </>
  );
}
