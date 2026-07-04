import { Plus } from "lucide-react";
import type { Member } from "../data";
import { MembersMobile } from "./members-mobile";
import { MembersBrowser } from "./members-browser";
import { AddMemberDialog } from "./add-member-dialog";
import { AdminOnly } from "@/lib/admin";
import type { JoinPreviewDTO } from "@/server/queries/members";

export interface MemberSummary {
  text: string;
  totalDeposits: string;
}

export function MembersList({ members, summary, joinPreview }: { members: Member[]; summary: MemberSummary; joinPreview: JoinPreviewDTO }) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-[1280px] p-[26px]">
          <div className="mb-[18px] flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">Members</h1>
              <p className="mt-[5px] text-[13px] font-medium leading-[1.4] text-mut">
                {summary.text} · {summary.totalDeposits} total deposits
              </p>
            </div>
            <AdminOnly>
              <AddMemberDialog preview={joinPreview} buttonClassName="flex items-center gap-1 rounded-[9px] bg-teal px-4 py-[11px] text-[13px] font-semibold leading-none text-white">
                <Plus className="size-3.5" strokeWidth={2.5} /> Add member
              </AddMemberDialog>
            </AdminOnly>
          </div>

          <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-[0_1px_2px_var(--shadow)]">
            <MembersBrowser members={members} />
          </div>
        </div>
      </div>

      {/* Mobile */}
      <MembersMobile members={members} summary={summary} joinPreview={joinPreview} />
    </>
  );
}
