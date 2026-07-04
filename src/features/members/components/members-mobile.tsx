"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AddMemberDialog } from "./add-member-dialog";
import { AdminOnly } from "@/lib/admin";
import { ViewToggle, type ListView } from "@/components/shared/view-toggle";
import type { Member } from "../data";
import { type MemberSummary } from "./members-list";
import type { JoinPreviewDTO } from "@/server/queries/members";
import { MemberCard } from "./member-card";
import { MembersTable } from "./members-table";

/** Members — mobile: header (summary + add + view toggle), then card or table view. */
export function MembersMobile({ members, summary, joinPreview }: { members: Member[]; summary: MemberSummary; joinPreview: JoinPreviewDTO }) {
  const [view, setView] = useState<ListView>("table");

  return (
    <div className="pb-[78px] md:hidden">
      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-3.5">
        <span className="min-w-0 truncate text-xs font-medium leading-[1.3] text-fnt">
          {summary.text} · {summary.totalDeposits} deposits
        </span>
        <div className="flex flex-none items-center gap-2">
          <AdminOnly>
            <AddMemberDialog
              preview={joinPreview}
              buttonAriaLabel="Add member"
              buttonClassName="flex size-9 flex-none items-center justify-center rounded-[9px] bg-teal text-white"
            >
              <Plus className="size-4" strokeWidth={2.5} />
            </AddMemberDialog>
          </AdminOnly>
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      {view === "cards" ? (
        <div className="flex flex-col gap-3 px-4">
          {members.map((m) => (
            <MemberCard key={m.id} m={m} />
          ))}
        </div>
      ) : (
        <div className="px-4">
          <div className="overflow-x-auto rounded-2xl border border-bd bg-sf">
            <div className="min-w-[720px]">
              <MembersTable members={members} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
