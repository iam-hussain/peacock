"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AddMemberDialog } from "./add-member-dialog";
import { AdminOnly } from "@/lib/admin";
import { ViewToggle, type ListView } from "@/components/shared/view-toggle";
import type { Member } from "../data";
import { filterMembers, type MemberFilter } from "../filter";
import type { JoinPreviewDTO } from "@/server/queries/members";
import { MemberCard } from "./member-card";
import { MembersTable } from "./members-table";
import { MemberStatusFilter } from "./member-status-filter";

/** Members — mobile: header (add + view toggle), status filter, then card or table view. */
export function MembersMobile({ members, joinPreview }: { members: Member[]; joinPreview: JoinPreviewDTO }) {
  const [view, setView] = useState<ListView>("table");
  const [filter, setFilter] = useState<MemberFilter>("active");

  const rows = useMemo(() => filterMembers(members, "", filter), [members, filter]);

  return (
    <div className="pb-19.5 md:hidden">
      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-3.5">
        <span className="min-w-0 truncate text-xs font-medium leading-130 text-fnt">
          {summary.text} · {summary.totalDeposits} deposits
        </span>
        <div className="flex flex-none items-center gap-2">
          <MemberStatusFilter value={filter} onChange={setFilter} />
          <AdminOnly>
            <AddMemberDialog
              preview={joinPreview}
              buttonAriaLabel="Add member"
              buttonClassName="flex size-9 flex-none items-center justify-center rounded-9 bg-teal text-white"
            >
              <Plus className="size-4" strokeWidth={2.5} />
            </AddMemberDialog>
          </AdminOnly>
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-14 text-center text-13 font-medium text-fnt">No members match.</div>
      ) : view === "cards" ? (
        <div className="flex flex-col gap-3 px-4">
          {rows.map((m) => (
            <MemberCard key={m.id} m={m} />
          ))}
        </div>
      ) : (
        <div className="px-4">
          <div className="overflow-x-auto rounded-2xl border border-bd bg-sf">
            <div className="min-w-[720px]">
              <MembersTable members={rows} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
