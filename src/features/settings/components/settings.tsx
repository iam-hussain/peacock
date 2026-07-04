"use client";

import { useState } from "react";
import { ProfileTab } from "./profile-tab";
import { ClubTab } from "./club-tab";
import { TreasuryTab } from "./treasury-tab";
import { AdminTab } from "./admin-tab";
import type { SettingsData } from "@/server/queries/settings";

const TABS = ["Profile", "Club", "Treasury", "Admin tools"] as const;

export function Settings({ isAdmin, club, treasury, profile, memberOptions, admins, quarter, auditCount }: SettingsData & { isAdmin: boolean }) {
  const [tab, setTab] = useState<string>("Profile");
  const tabs = isAdmin ? TABS : TABS.filter((t) => t !== "Admin tools");
  return (
    <div className="mx-auto max-w-320 p-4 pb-19.5 md:p-6.5 md:pb-6.5">
      <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">Settings</h1>
      <p className="mb-4.5 mt-1 text-13 font-medium leading-140 text-mut">
        Manage your profile, the club, and admin tools.
      </p>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-7">
        {/* tabs */}
        <div role="tablist" className="flex flex-none gap-1 overflow-x-auto md:sticky md:top-6.5 md:w-[196px] md:flex-col">
          {tabs.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-10 px-3.5 py-2.5 text-left text-13 font-semibold leading-none transition-colors ${
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
          {tab === "Club" && <ClubTab club={club} isAdmin={isAdmin} />}
          {tab === "Treasury" && <TreasuryTab treasury={treasury} />}
          {tab === "Admin tools" && isAdmin && <AdminTab memberOptions={memberOptions} admins={admins} quarter={quarter} auditCount={auditCount} />}
        </div>
      </div>
    </div>
  );
}
