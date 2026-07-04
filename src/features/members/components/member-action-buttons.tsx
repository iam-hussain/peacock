"use client";

import { UserPen, LogOut } from "lucide-react";
import { FormModalButton } from "@/components/shared/form-modal-button";
import { SettleDialog } from "./settle-modal";
import type { MemberDetailDTO as MemberDetail } from "@/server/queries/members";

export function EditMemberButton({ m, compact = false }: { m: MemberDetail; compact?: boolean }) {
  return (
    <FormModalButton
      title="Edit member details"
      subtitle={m.name}
      kind="editMember"
      submitLabel="Save changes"
      hiddenFields={{ id: m.id }}
      fields={[
        { name: "name", label: "Full name", defaultValue: m.name, required: true },
        { name: "phone", label: "Phone", type: "tel", placeholder: "+91 …", defaultValue: m.phone },
        { name: "email", label: "Email", type: "email", placeholder: "optional", defaultValue: m.email },
        { name: "username", label: "Username", defaultValue: m.username },
      ]}
      buttonClassName={`flex items-center justify-center gap-2 rounded-11 border border-bd2 bg-sf p-3.25 text-13 font-semibold leading-none text-ink hover:bg-sf2 ${compact ? "flex-1" : ""}`}
    >
      <UserPen className="size-3.75" strokeWidth={2} /> {compact ? "Edit details" : "Edit member details"}
    </FormModalButton>
  );
}

// Danger-outline "Settle up & leave" trigger (active members only). `compact` = mobile side-by-side row.
export function SettleButton({ m, compact = false }: { m: MemberDetail; compact?: boolean }) {
  if (!m.settle) return null;
  return (
    <SettleDialog
      memberId={m.id}
      memberName={m.name}
      settle={m.settle}
      treasurers={m.treasurerOptions}
      className={`flex items-center justify-center gap-2 rounded-11 border border-outbd bg-sf p-3.25 text-13 font-semibold leading-none text-out hover:bg-outbg ${compact ? "flex-1" : ""}`}
    >
      <LogOut className="size-3.75" strokeWidth={2} /> {compact ? "Settle & leave" : "Settle up & leave"}
    </SettleDialog>
  );
}
