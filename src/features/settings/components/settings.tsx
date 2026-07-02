"use client";

import { useState } from "react";
import { Users, FileText, CalendarClock, KeyRound, Database, Download, ChevronRight, LogOut, Shield, Pencil, Vault, ChevronDown } from "lucide-react";
import Link from "next/link";
import { FormModalButton } from "@/components/shared/form-modal-button";
import type { PickOption } from "@/components/shared/entity-picker";
import type { SettingsData } from "@/server/queries/settings";

const CHANGE_PW_FIELDS = [
  { name: "current", label: "Current password", type: "password" as const, required: true },
  { name: "new", label: "New password", type: "password" as const, required: true },
  { name: "confirm", label: "Confirm new password", type: "password" as const, required: true },
];

const TABS = ["Admin tools", "Profile", "Club", "Treasury"] as const;

function ini(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function Settings({ club, treasury, profile, memberOptions }: SettingsData) {
  const [tab, setTab] = useState<string>("Profile");
  return (
    <div className="mx-auto max-w-[1280px] p-4 pb-[78px] md:p-[26px] md:pb-[26px]">
      <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">Settings</h1>
      <p className="mb-[18px] mt-1 text-[13px] font-medium leading-[1.4] text-mut">
        Manage your profile, the club, and admin tools.
      </p>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-7">
        {/* tabs */}
        <div className="flex flex-none gap-1 overflow-x-auto md:sticky md:top-[26px] md:w-[196px] md:flex-col">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-[10px] px-3.5 py-2.5 text-left text-[13px] font-semibold leading-none transition-colors ${
                tab === t ? "bg-tlsf text-teal" : "text-mut hover:bg-bg"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* content */}
        <div className="min-w-0 flex-1">
          {tab === "Profile" && <ProfileTab profile={profile} />}
          {tab === "Club" && <ClubTab club={club} />}
          {tab === "Treasury" && <TreasuryTab treasury={treasury} />}
          {tab === "Admin tools" && <AdminTab memberOptions={memberOptions} />}
        </div>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-[0_1px_2px_var(--shadow)]">{children}</div>;
}
function FieldRow({ label, value, last = false, mono = true }: { label: string; value: string; last?: boolean; mono?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-5 py-3.5 ${last ? "" : "border-b border-hr2"}`}>
      <span className="text-[13px] font-medium leading-none text-mut">{label}</span>
      <span className={`text-[13px] font-semibold leading-none text-ink ${mono ? "font-mono" : "font-sans"}`}>{value}</span>
    </div>
  );
}

function ProfileTab({ profile }: { profile: SettingsData["profile"] }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center gap-3.5 border-b border-hr2 px-5 py-[18px]">
          <span className="relative flex size-[52px] flex-none items-center justify-center rounded-full bg-teal text-lg font-bold text-white">
            {ini(profile.name)}
            <button
              aria-label="Edit photo"
              className="absolute -bottom-0.5 -right-0.5 flex size-[22px] items-center justify-center rounded-full border-2 border-sf bg-teal text-white"
            >
              <Pencil className="size-[11px]" strokeWidth={2.4} />
            </button>
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold leading-none text-ink">{profile.name}</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-tlsf px-[7px] py-1 text-[9px] font-bold uppercase leading-none tracking-[0.05em] text-teal">
                <Shield className="size-2.5" strokeWidth={2.4} /> {profile.role}
              </span>
            </div>
            <div className="mt-1.5 text-xs font-medium leading-none text-fnt">Treasurer · since 2020</div>
          </div>
          <button className="text-xs font-semibold leading-none text-teal">Change</button>
        </div>
        <FieldRow label="Full name" value={profile.name} mono={false} />
        <FieldRow label="Email" value={profile.email} />
        <FieldRow label="Phone" value={profile.phone} />
        <FieldRow label="Username" value={profile.username} />
        <div className="flex items-center justify-between px-5 py-3.5">
          <div>
            <div className="text-[13px] font-medium leading-none text-mut">Password</div>
            <div className="mt-1.5 font-mono text-[13px] font-semibold tracking-[0.12em] text-ink">••••••••</div>
          </div>
          <FormModalButton
            title="Change password"
            kind="changePassword"
            submitLabel="Update password"
            fields={CHANGE_PW_FIELDS}
            buttonClassName="rounded-lg border border-bd2 px-3 py-2 text-xs font-semibold leading-none text-teal"
          >
            Change password
          </FormModalButton>
        </div>
      </Card>

      <Card>
        <div className="border-b border-hair px-5 py-4 text-[12px] font-bold uppercase leading-none tracking-[0.06em] text-teal">
          Appearance
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <div className="text-sm font-bold leading-none text-ink">Theme</div>
            <div className="mt-1 text-xs font-medium leading-none text-fnt">Light or dark interface</div>
          </div>
          <div className="flex gap-[3px] rounded-[9px] bg-bg2 p-[3px]">
            <span className="rounded-[7px] bg-sf px-3.5 py-2 text-xs font-semibold leading-none text-ink shadow-sm">Light</span>
            <span className="rounded-[7px] px-3.5 py-2 text-xs font-semibold leading-none text-mut">Dark</span>
          </div>
        </div>
      </Card>

      <Link
        href="/"
        className="flex items-center justify-center gap-2 rounded-[14px] border border-bd bg-sf px-5 py-4 text-sm font-semibold leading-none text-out hover:bg-outbg"
      >
        <LogOut className="size-[15px]" strokeWidth={2} /> Sign out
      </Link>
    </div>
  );
}

function ClubTab({ club }: { club: SettingsData["club"] }) {
  const rules = [
    { l: "Limit", v: club.loanLimit },
    { l: "Term", v: club.term },
    { l: "Cooldown", v: club.cooldown },
    { l: "Overdue penalty", v: club.overdue },
  ];
  return (
    <Card>
      <div className="flex items-center gap-3.5 border-b border-hr2 px-5 py-[18px]">
        <span className="flex size-[50px] flex-none items-center justify-center rounded-[15px] bg-teal">
          <span className="flex size-[22px] items-center justify-center rounded-full bg-teal-dark">
            <span className="size-[9px] rounded-full bg-gold" />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-bold leading-[1.15] text-ink">{club.name}</div>
          <div className="mt-1.5 text-xs font-medium leading-none text-fnt">{club.meta}</div>
        </div>
        <button className="rounded-lg border border-bd2 px-3.5 py-2.5 text-xs font-semibold leading-none text-teal hover:bg-tlsf">
          Edit
        </button>
      </div>
      <div className="flex border-b border-hr2">
        <div className="flex-1 border-r border-hr2 px-5 py-4">
          <div className="text-[10px] font-semibold uppercase leading-none tracking-[0.06em] text-fnt">Monthly deposit</div>
          <div className="mt-[9px] font-mono text-[21px] font-bold leading-none text-ink">{club.deposit}</div>
          <div className="mt-1.5 text-[11px] font-medium leading-none text-fnt">current stage</div>
        </div>
        <div className="flex-1 px-5 py-4">
          <div className="text-[10px] font-semibold uppercase leading-none tracking-[0.06em] text-fnt">Loan interest</div>
          <div className="mt-[9px] font-mono text-[21px] font-bold leading-none text-ink">{club.rate}</div>
          <div className="mt-1.5 text-[11px] font-medium leading-none text-fnt">new loans</div>
        </div>
      </div>
      <div className="border-b border-hr2 px-5 py-4">
        <div className="mb-[15px] text-[11px] font-semibold uppercase leading-none tracking-[0.04em] text-fnt">Loan rules</div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          {rules.map((r) => (
            <div key={r.l}>
              <div className="text-xs font-medium leading-none text-mut">{r.l}</div>
              <div className="mt-[7px] font-mono text-sm font-semibold leading-none text-ink">{r.v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between border-b border-hr2 px-5 py-3.5">
        <div>
          <div className="text-sm font-bold leading-none text-ink">Dividend distribution</div>
          <div className="mt-1 text-[11px] font-medium leading-none text-fnt">Profit accumulates in the club when off</div>
        </div>
        <span className="rounded-[20px] bg-nbg px-2.5 py-1.5 text-[10px] font-bold leading-none text-nfg">{club.dividend}</span>
      </div>
      <div className="flex items-center justify-between border-b border-hr2 px-5 py-3.5">
        <span className="text-sm font-bold leading-none text-ink">Timezone</span>
        <span className="font-mono text-[13px] leading-none text-mut">{club.timezone}</span>
      </div>
      <RateDepositHistory />
    </Card>
  );
}

const DEPOSIT_STAGES = [
  { amount: "₹2,000", range: "2019 – 2020" },
  { amount: "₹3,000", range: "2021 – 2022" },
  { amount: "₹5,000", range: "2023 – present" },
];
const RATE_SCHEDULE = [
  { rate: "1.5% / mo", range: "2019 – 2021", current: false },
  { rate: "1.25% / mo", range: "2022 – 2023", current: false },
  { rate: "1% / mo", range: "2024 – present", current: true },
];

function RateDepositHistory() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left text-[13px] font-semibold leading-none text-teal hover:bg-tlsf"
      >
        Rate &amp; deposit history
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2.4} />
      </button>
      {open && (
        <div className="border-t border-hr2 px-5 py-4">
          <div className="mb-2.5 text-[10px] font-semibold uppercase leading-none tracking-[0.06em] text-fnt">Deposit stages</div>
          <div className="flex flex-col gap-2">
            {DEPOSIT_STAGES.map((s) => (
              <div key={s.range} className="flex items-center justify-between">
                <span className="font-mono text-[13px] font-semibold leading-none text-ink">{s.amount}</span>
                <span className="text-[11px] font-medium leading-none text-fnt">{s.range}</span>
              </div>
            ))}
          </div>

          <div className="mb-2.5 mt-[18px] text-[10px] font-semibold uppercase leading-none tracking-[0.06em] text-fnt">Loan interest schedule</div>
          <div className="flex flex-col gap-2">
            {RATE_SCHEDULE.map((r) => (
              <div key={r.range} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[13px] font-semibold leading-none text-ink">{r.rate}</span>
                  {r.current && (
                    <span className="rounded-md bg-tlsf px-[6px] py-1 text-[9px] font-bold uppercase leading-none tracking-[0.05em] text-teal">
                      Current
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-medium leading-none text-fnt">{r.range}</span>
              </div>
            ))}
          </div>

          <div className="mt-[18px] flex items-center justify-between border-t border-hr2 pt-3.5">
            <span className="text-[13px] font-medium leading-none text-mut">Daily interest from</span>
            <span className="font-mono text-[13px] font-semibold leading-none text-ink">1 Jan 2024</span>
          </div>
          <div className="mt-3 text-[11px] font-medium leading-[1.5] text-fnt">
            Rate changes apply to new loans only — existing loans keep the rate fixed at origination.
          </div>
        </div>
      )}
    </div>
  );
}

function TreasuryTab({ treasury }: { treasury: SettingsData["treasury"] }) {
  return (
    <Card>
      <div className="flex items-center gap-3 border-b border-hr2 px-5 py-[18px]">
        <span className="flex size-10 flex-none items-center justify-center rounded-[11px] bg-tlsf text-teal">
          <Vault className="size-[19px]" strokeWidth={2} />
        </span>
        <div className="flex-1">
          <div className="text-base font-bold leading-[1.1] text-ink">Treasury &amp; cash holdings</div>
          <div className="mt-1 text-xs font-medium leading-[1.3] text-fnt">
            The club has no account of its own — these members hold its cash.
          </div>
        </div>
      </div>
      <div className="px-5 py-4">
        <div className="flex flex-col gap-2.5">
          {treasury.map((t) => (
            <div key={t.name} className="flex items-center gap-3 rounded-[13px] border border-bd px-[15px] py-3.5">
              <span className="flex size-10 flex-none items-center justify-center rounded-full bg-teal text-[13px] font-bold text-white">
                {ini(t.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold leading-none text-ink">{t.name}</div>
                <div className="mt-1 text-[11px] font-medium leading-none text-fnt">Holds club cash · belongs to the club</div>
              </div>
              <span className="font-mono text-[15px] font-semibold leading-none text-ink">{t.holds}</span>
            </div>
          ))}
        </div>
        <div className="mt-3.5 rounded-xl bg-tlsf px-3.5 py-[13px] text-xs font-medium leading-[1.5] text-mut">
          Holding cash is <span className="font-semibold text-ink">automatic</span> — anyone listed on an entry as the
          holder shows up here. There&apos;s no setting to make someone a treasurer.
        </div>
      </div>
    </Card>
  );
}

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
    <div className={`flex w-full items-center gap-3 bg-sf px-5 py-[15px] text-left hover:bg-bg ${wide ? "sm:col-span-2" : ""}`}>
      <span className={`flex size-[34px] flex-none items-center justify-center rounded-[10px] ${tone === "warn" ? "bg-wbg text-wfg" : "bg-tlsf text-teal"}`}>
        <Icon className="size-[17px]" strokeWidth={2} />
      </span>
      <div className="flex-1">
        <div className="text-[13px] font-semibold leading-none text-ink">{title}</div>
        <div className="mt-1 text-[11px] font-medium leading-[1.3] text-fnt">{sub}</div>
      </div>
      <ChevronRight className="size-4 text-fnt" strokeWidth={2} />
    </div>
  );
}

function AdminTab({ memberOptions }: { memberOptions: SettingsData["memberOptions"] }) {
  const memberOpts: PickOption[] = memberOptions.map((m) => ({ id: m.value, name: m.label }));
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-[0_1px_2px_var(--shadow)]">
        <div className="grid grid-cols-1 gap-px bg-hair sm:grid-cols-2">
          <FormModalButton
            title="Add admin"
            subtitle="Promote a member to admin (write access)."
            kind="addAdmin"
            submitLabel="Make admin"
            fields={[{ name: "member", label: "Member", placeholder: "No member selected", pickerOptions: memberOpts, pickerTitle: "Choose a member", pickerSubtitle: "Promote this member to admin.", pickerSearch: "Search members" }]}
          >
            <ActionInner icon={Users} tone="teal" title="Admins" sub="2 admins · add another" />
          </FormModalButton>
          <Link href="/audit">
            <ActionInner icon={FileText} tone="teal" title="Audit log" sub="128 recorded events" />
          </Link>
          <FormModalButton
            title="Close quarter"
            subtitle="Lock this quarter's entries and store a profit snapshot. This cannot be undone."
            kind="closeQuarter"
            submitLabel="Close & snapshot"
            destructive
            fields={[{ name: "note", label: "Note (optional)", type: "textarea", placeholder: "Anything to record with the close…" }]}
            buttonClassName="sm:col-span-2"
          >
            <ActionInner icon={CalendarClock} tone="warn" title="Close quarter" sub="Lock the quarter & snapshot · Q2 open" wide />
          </FormModalButton>
          <FormModalButton
            title="Reset a member's password"
            subtitle="Resets to their phone number, or set a custom one."
            kind="resetPassword"
            submitLabel="Reset password"
            fields={[
              { name: "member", label: "Member", placeholder: "No member selected", pickerOptions: memberOpts, pickerTitle: "Choose a member", pickerSubtitle: "Reset this member's password.", pickerSearch: "Search members" },
              { name: "custom", label: "Custom password", placeholder: "Leave blank to reset to phone number" },
            ]}
            buttonClassName="sm:col-span-2"
          >
            <ActionInner icon={KeyRound} tone="teal" title="Reset a member's password" sub="Resets to their phone number, or set a custom one" wide />
          </FormModalButton>
        </div>
      </div>

      <div>
        <div className="mb-[11px] text-[11px] font-bold uppercase leading-none tracking-[0.06em] text-fnt">Backup &amp; data</div>
        <Card>
          <div className="flex items-center gap-3.5 border-b border-hr2 px-5 py-[18px]">
            <span className="flex size-10 flex-none items-center justify-center rounded-[11px] bg-wbg text-wfg">
              <Database className="size-5" strokeWidth={2} />
            </span>
            <div className="flex-1">
              <div className="text-sm font-bold leading-none text-ink">Create backup</div>
              <div className="mt-1 text-xs font-medium leading-[1.4] text-fnt">Download all club data as a JSON file.</div>
            </div>
            <button className="rounded-lg bg-tlsf px-3.5 py-2.5 text-xs font-semibold leading-none text-teal">Create backup</button>
          </div>
          <div className="flex items-center gap-3.5 px-5 py-[18px]">
            <span className="flex size-10 flex-none items-center justify-center rounded-[11px] bg-tlsf text-teal">
              <Download className="size-5" strokeWidth={2} />
            </span>
            <div className="flex-1">
              <div className="text-sm font-bold leading-none text-ink">Restore from backup</div>
              <div className="mt-1 text-xs font-medium leading-[1.4] text-fnt">Import a previously saved JSON backup.</div>
            </div>
            <button className="rounded-lg border border-bd2 px-3.5 py-2.5 text-xs font-semibold leading-none text-ink">Import</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
