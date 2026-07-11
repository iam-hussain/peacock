"use client";

import Link from "next/link";
import { ShieldAlert, FileClock, Users, KeyRound, CalendarClock, Database, Download, ChevronRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { FormModalButton } from "@/components/shared/form-modal-button";
import { AdminsButton } from "@/features/settings/components/admins-modal";
import { CloseQuarterButton } from "@/features/settings/components/close-quarter-modal";
import { CreateBackupButton, ImportButton } from "@/features/settings/components/backup-buttons";
import type { PickOption } from "@/components/shared/entity-picker";
import type { SettingsData } from "@/server/queries/settings";

type Data = SettingsData & { isAdmin: boolean };

export function AdminHub({ data }: { data: Data }) {
  if (!data.isAdmin) {
    return (
      <div className="mx-auto max-w-140 p-4 pb-19.5 md:p-6.5">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-bd bg-sf px-6 py-14 text-center shadow-card">
          <ShieldAlert className="size-8 text-fnt" strokeWidth={1.8} />
          <div className="text-15 font-bold leading-none text-ink">Admin</div>
          <div className="text-13 font-medium leading-140 text-mut">This area is for club admins only.</div>
        </div>
      </div>
    );
  }

  const { admins, quarter, auditCount, memberOptions, club } = data;
  const memberOpts: PickOption[] = memberOptions.map((m) => ({ id: m.value, name: m.label, sub: m.sub }));
  const penaltyOn = club.penalty.deposit.enabled || club.penalty.interest.enabled;

  return (
    <div className="mx-auto max-w-320 p-4 pb-19.5 md:p-6.5 md:pb-6.5">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">Admin</h1>
          <p className="mt-1.75 text-13 font-medium leading-140 text-mut">
            Everything only managers can touch — penalties, the audit trail, people, and club data.
          </p>
        </div>
        <div className="flex gap-2.5">
          <Stat value={String(admins.length)} label={admins.length === 1 ? "admin" : "admins"} />
          <Stat value={String(auditCount)} label="audit events" />
          <Stat value={penaltyOn ? "On" : "Off"} label="auto penalties" tone={penaltyOn ? "teal" : "mut"} />
        </div>
      </div>

      {/* Featured: auto penalties */}
      <Link
        href="/penalties"
        className="group mb-4 flex items-center gap-4 overflow-hidden rounded-2xl border border-teal/25 bg-gradient-to-br from-tlsf to-sf px-5 py-4.5 shadow-card transition-colors hover:border-teal/40"
      >
        <span className="flex size-12 flex-none items-center justify-center rounded-14 bg-teal text-white shadow-[0_6px_16px_rgba(14,140,130,0.35)]">
          <ShieldAlert className="size-6" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-15 font-bold leading-none text-ink">Auto penalties</span>
            <span className={`rounded-20 px-2 py-1 text-9 font-bold uppercase leading-none tracking-3 ${penaltyOn ? "bg-teal text-white" : "bg-nbg text-nfg"}`}>
              {penaltyOn ? "Active" : "Off"}
            </span>
          </div>
          <div className="mt-1.5 text-12 font-medium leading-tight text-mut">
            Deposit {club.penalty.deposit.enabled ? club.penalty.deposit.rate : "off"} · Loan-interest {club.penalty.interest.enabled ? club.penalty.interest.rate : "off"} · from {club.penalty.effectiveFrom}. Review, tune & sync.
          </div>
        </div>
        <ArrowUpRight className="size-5 flex-none text-teal transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.2} />
      </Link>

      {/* Tool grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ToolLink href="/audit" icon={FileClock} title="Audit log" sub={`${auditCount} recorded event${auditCount === 1 ? "" : "s"}`} />

        <AdminsButton admins={admins} members={memberOptions} className="w-full text-left">
          <ToolFace icon={Users} title="Admins" sub={`${admins.length} admin${admins.length === 1 ? "" : "s"} · add or remove`} />
        </AdminsButton>

        <FormModalButton
          title="Reset a member's password"
          subtitle="Resets to their phone number, or set a custom one."
          kind="resetPassword"
          submitLabel="Reset password"
          fields={[
            { name: "member", label: "Member", placeholder: "No member selected", pickerOptions: memberOpts, pickerSearch: "Search members" },
            { name: "custom", label: "Custom password", placeholder: "Leave blank to reset to phone number" },
          ]}
          buttonClassName="w-full text-left"
        >
          <ToolFace icon={KeyRound} title="Reset password" sub="Reset a member to their phone, or a custom value" />
        </FormModalButton>

        <CloseQuarterButton quarter={quarter} className="w-full text-left">
          <ToolFace icon={CalendarClock} tone="warn" title="Close quarter" sub={`${quarter.label} · ${quarter.alreadyClosed ? "closed" : "open"} — lock & snapshot`} />
        </CloseQuarterButton>
      </div>

      {/* Backup & data */}
      <div className="mt-5">
        <div className="mb-2.75 text-11 font-bold uppercase leading-none tracking-6 text-fnt">Backup &amp; data</div>
        <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-card">
          <div className="flex items-center gap-3.5 border-b border-hr2 px-5 py-4.5">
            <Tile icon={Database} tone="warn" />
            <div className="flex-1">
              <div className="text-sm font-bold leading-none text-ink">Create backup</div>
              <div className="mt-1 text-xs font-medium leading-140 text-fnt">Download all club data as a JSON file.</div>
            </div>
            <CreateBackupButton />
          </div>
          <div className="flex items-center gap-3.5 px-5 py-4.5">
            <Tile icon={Download} />
            <div className="flex-1">
              <div className="text-sm font-bold leading-none text-ink">Restore from backup</div>
              <div className="mt-1 text-xs font-medium leading-140 text-fnt">Import a previously saved JSON backup.</div>
            </div>
            <ImportButton />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, tone = "ink" }: { value: string; label: string; tone?: "ink" | "teal" | "mut" }) {
  const color = tone === "teal" ? "text-teal" : tone === "mut" ? "text-mut" : "text-ink";
  return (
    <div className="rounded-14 border border-bd bg-sf px-3.5 py-2.5 text-center shadow-card">
      <div className={`font-mono text-17 font-bold leading-none ${color}`}>{value}</div>
      <div className="mt-1.5 text-10 font-semibold uppercase leading-none tracking-3 text-fnt">{label}</div>
    </div>
  );
}

function Tile({ icon: Icon, tone = "teal" }: { icon: LucideIcon; tone?: "teal" | "warn" }) {
  return (
    <span className={`flex size-10 flex-none items-center justify-center rounded-11 ${tone === "warn" ? "bg-wbg text-wfg" : "bg-tlsf text-teal"}`}>
      <Icon className="size-5" strokeWidth={2} />
    </span>
  );
}

// A tool rendered as a link (navigates).
function ToolLink({ href, icon, title, sub }: { href: string; icon: LucideIcon; title: string; sub: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-bd bg-sf shadow-card transition-colors hover:bg-bg">
      <ToolFace icon={icon} title={title} sub={sub} />
    </Link>
  );
}

// The shared inner face for every tool card (used by links and by modal-trigger buttons).
function ToolFace({ icon: Icon, title, sub, tone = "teal" }: { icon: LucideIcon; title: string; sub: string; tone?: "teal" | "warn" }) {
  return (
    <div className="flex w-full items-center gap-3.5 rounded-2xl px-5 py-4.5">
      <Tile icon={Icon} tone={tone} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold leading-none text-ink">{title}</div>
        <div className="mt-1.25 text-11 font-medium leading-130 text-fnt">{sub}</div>
      </div>
      <ChevronRight className="size-4 flex-none text-fnt" strokeWidth={2} />
    </div>
  );
}
