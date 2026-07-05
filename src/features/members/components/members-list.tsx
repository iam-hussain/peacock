import { Plus } from "lucide-react";
import type { Member } from "../data";
import { MembersMobile } from "./members-mobile";
import { MembersBrowser } from "./members-browser";
import { AddMemberDialog } from "./add-member-dialog";
import { AdminOnly } from "@/lib/admin";
import type { JoinPreviewDTO } from "@/server/queries/members";

export function MembersList({ members, joinPreview }: { members: Member[]; joinPreview: JoinPreviewDTO }) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-320 p-6.5">
          <div className="mb-4.5 flex items-center justify-between">
            <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">Members</h1>
            <AdminOnly>
              <AddMemberDialog preview={joinPreview} buttonClassName="flex items-center gap-1 rounded-9 bg-teal px-4 py-2.75 text-13 font-semibold leading-none text-white">
                <Plus className="size-3.5" strokeWidth={2.5} /> Add member
              </AddMemberDialog>
            </AdminOnly>
          </div>

          <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-card">
            <MembersBrowser members={members} />
          </div>
        </div>
      </div>

      {/* Mobile */}
      <MembersMobile members={members} joinPreview={joinPreview} />
    </>
  );
}
