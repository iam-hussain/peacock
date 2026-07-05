"use client";

import { useState } from "react";
import {
  Workflow,
  Wallet,
  HandCoins,
  Building2,
  Trophy,
  DoorOpen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TabOverview } from "./tab-overview";
import { TabDeposits } from "./tab-deposits";
import { TabLoans } from "./tab-loans";
import { TabVendors } from "./tab-vendors";
import { TabProfit } from "./tab-profit";
import { TabExit } from "./tab-exit";

const TABS: { id: string; label: string; short: string; icon: LucideIcon; Panel: () => React.ReactNode }[] = [
  { id: "overview", label: "Overview", short: "Overview", icon: Workflow, Panel: TabOverview },
  { id: "deposits", label: "Deposits & catch-up", short: "Deposits", icon: Wallet, Panel: TabDeposits },
  { id: "loans", label: "Loans & interest", short: "Loans", icon: HandCoins, Panel: TabLoans },
  { id: "vendors", label: "Vendors & chits", short: "Vendors", icon: Building2, Panel: TabVendors },
  { id: "profit", label: "Profit & shares", short: "Profit", icon: Trophy, Panel: TabProfit },
  { id: "exit", label: "Leaving & rejoining", short: "Leaving", icon: DoorOpen, Panel: TabExit },
];

export function HowTabs() {
  const [active, setActive] = useState(TABS[0].id);
  const ActivePanel = TABS.find((t) => t.id === active)?.Panel ?? TABS[0].Panel;

  return (
    <div>
      {/* Tab bar — horizontally scrollable on mobile, wraps on desktop. Sticky under the header. */}
      <div className="sticky top-14 z-20 -mx-4 mb-5 border-b border-hair bg-sf/85 px-4 backdrop-blur md:top-16 md:mx-0 md:rounded-14 md:border md:bg-sf md:px-2 md:py-2">
        <div
          role="tablist"
          aria-label="How Peacock works"
          className="flex gap-1.5 overflow-x-auto py-2.5 [scrollbar-width:none] md:flex-wrap md:justify-center md:py-0 [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((t) => {
            const on = t.id === active;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={on}
                onClick={() => setActive(t.id)}
                className={cn(
                  "flex flex-none items-center gap-1.75 rounded-11 px-3.25 py-2 text-13 font-semibold leading-none transition-colors",
                  on ? "bg-teal text-white" : "text-mut hover:bg-tlsf hover:text-teal",
                )}
              >
                <t.icon className="size-4" strokeWidth={2.2} />
                {/* Full labels only where all six fit on one line; short otherwise. */}
                <span className="xl:hidden">{t.short}</span>
                <span className="hidden xl:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel — remounts on change so the entrance animation replays. */}
      <div key={active} className="hiw-rise">
        <ActivePanel />
      </div>
    </div>
  );
}
