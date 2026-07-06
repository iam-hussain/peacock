"use client";

import { Users, FileText, CalendarClock, KeyRound, Database, Download, ChevronRight } from "lucide-react";
import Link from "next/link";
import { FormModalButton } from "@/components/shared/form-modal-button";
import { CreateBackupButton, ImportButton } from "./backup-buttons";
import { AdminsButton } from "./admins-modal";
import { CloseQuarterButton } from "./close-quarter-modal";
import { Card } from "./settings-primitives";
import type { PickOption } from "@/components/shared/entity-picker";
import type { SettingsData } from "@/server/queries/settings";

function ActionInner({
  icon: Icon,
  tone,
  title,
  sub,
  wide,
}: {
  icon: typeof Users;
  tone: "teal" | "warn";
  title: string;
  sub: string;
  wide?: boolean;
}) {
  return (
    <div className={`flex w-full items-center gap-3 bg-sf px-5 py-3.75 text-left hover:bg-bg ${wide ? "sm:col-span-2" : ""}`}>
      <span className={`flex size-8.5 flex-none items-center justify-center rounded-10 ${tone === "warn" ? "bg-wbg text-wfg" : "bg-tlsf text-teal"}`}>
        <Icon className="size-4.25" strokeWidth={2} />
      </span>
      <div className="flex-1">
        <div className="text-13 font-semibold leading-none text-ink">{title}</div>
        <div className="mt-1 text-11 font-medium leading-130 text-fnt">{sub}</div>
      </div>
      <ChevronRight className="size-4 text-fnt" strokeWidth={2} />
    </div>
  );
}

export function AdminTab({
  memberOptions,
  admins,
  quarter,
  auditCount,
}: {
  memberOptions: SettingsData["memberOptions"];
  admins: SettingsData["admins"];
  quarter: SettingsData["quarter"];
  auditCount: number;
}) {
  const memberOpts: PickOption[] = memberOptions.map((m) => ({ id: m.value, name: m.label, sub: m.sub }));
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-card">
        <div className="grid grid-cols-1 gap-px bg-hair sm:grid-cols-2">
          <AdminsButton admins={admins} members={memberOptions} className="w-full text-left">
            <ActionInner icon={Users} tone="teal" title="Admins" sub={`${admins.length} admin${admins.length === 1 ? "" : "s"} · add or remove`} />
          </AdminsButton>
          <Link href="/audit">
            <ActionInner icon={FileText} tone="teal" title="Audit log" sub={`${auditCount} recorded event${auditCount === 1 ? "" : "s"}`} />
          </Link>
          <CloseQuarterButton quarter={quarter} className="sm:col-span-2">
            <ActionInner
              icon={CalendarClock}
              tone="warn"
              title="Close quarter"
              sub={`Lock the quarter & snapshot · ${quarter.label} ${quarter.alreadyClosed ? "closed" : "open"}`}
              wide
            />
          </CloseQuarterButton>
          <FormModalButton
            title="Reset a member's password"
            subtitle="Resets to their phone number, or set a custom one."
            kind="resetPassword"
            submitLabel="Reset password"
            fields={[
              { name: "member", label: "Member", placeholder: "No member selected", pickerOptions: memberOpts, pickerSearch: "Search members" },
              { name: "custom", label: "Custom password", placeholder: "Leave blank to reset to phone number" },
            ]}
            buttonClassName="sm:col-span-2"
          >
            <ActionInner icon={KeyRound} tone="teal" title="Reset a member's password" sub="Resets to their phone number, or set a custom one" wide />
          </FormModalButton>
        </div>
      </div>

      <div>
        <div className="mb-2.75 text-11 font-bold uppercase leading-none tracking-6 text-fnt">Backup &amp; data</div>
        <Card>
          <div className="flex items-center gap-3.5 border-b border-hr2 px-5 py-4.5">
            <span className="flex size-10 flex-none items-center justify-center rounded-11 bg-wbg text-wfg">
              <Database className="size-5" strokeWidth={2} />
            </span>
            <div className="flex-1">
              <div className="text-sm font-bold leading-none text-ink">Create backup</div>
              <div className="mt-1 text-xs font-medium leading-140 text-fnt">Download all club data as a JSON file.</div>
            </div>
            <CreateBackupButton />
          </div>
          <div className="flex items-center gap-3.5 px-5 py-4.5">
            <span className="flex size-10 flex-none items-center justify-center rounded-11 bg-tlsf text-teal">
              <Download className="size-5" strokeWidth={2} />
            </span>
            <div className="flex-1">
              <div className="text-sm font-bold leading-none text-ink">Restore from backup</div>
              <div className="mt-1 text-xs font-medium leading-140 text-fnt">Import a previously saved JSON backup.</div>
            </div>
            <ImportButton />
          </div>
        </Card>
      </div>
    </div>
  );
}
