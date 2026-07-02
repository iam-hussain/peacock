import { Plus, ChevronDown } from "lucide-react";
import type { Member } from "../data";
import { MembersMobile } from "./members-mobile";
import { MembersTable } from "./members-table";
import { FormModalButton } from "@/components/shared/form-modal-button";

export interface MemberSummary {
  text: string;
  totalDeposits: string;
}

export const ADD_MEMBER_FIELDS = [
  { name: "name", label: "Full name", placeholder: "e.g. Anita Rao", required: true },
  { name: "phone", label: "Phone", type: "tel" as const, placeholder: "+91 …", required: true, hint: "Doubles as the default password." },
  { name: "email", label: "Email", type: "email" as const, placeholder: "optional" },
  { name: "username", label: "Username", placeholder: "auto-generated if blank" },
];

export function MembersList({ members, summary }: { members: Member[]; summary: MemberSummary }) {
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
            <FormModalButton
              title="Add member"
              subtitle="Create a new member profile."
              kind="addMember"
              submitLabel="Add member"
              fields={ADD_MEMBER_FIELDS}
              buttonClassName="flex items-center gap-1 rounded-[9px] bg-teal px-4 py-[11px] text-[13px] font-semibold leading-none text-white"
            >
              <Plus className="size-3.5" strokeWidth={2.5} /> Add member
            </FormModalButton>
          </div>

          <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-[0_1px_2px_var(--shadow)]">
            <div className="flex items-center gap-2.5 border-b border-hair px-5 py-4">
              <div className="flex-1 rounded-[10px] border border-bd2 px-[13px] py-2.5 text-[13px] font-medium leading-none text-fnt">
                Search members…
              </div>
              <button className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-bd2 px-3 py-[9px] text-xs font-semibold leading-none text-mut hover:bg-sf2">
                All members <ChevronDown className="size-3 text-fnt" />
              </button>
            </div>

            <MembersTable members={members} />
          </div>
        </div>
      </div>

      {/* Mobile */}
      <MembersMobile members={members} summary={summary} />
    </>
  );
}
