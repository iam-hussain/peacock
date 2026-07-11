"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { EditClubButton } from "./edit-club-modal";
import { Card } from "./settings-primitives";
import type { SettingsData } from "@/server/queries/settings";

export function ClubTab({ club, isAdmin }: { club: SettingsData["club"]; isAdmin: boolean }) {
  const rules = [
    { l: "Limit", v: club.loanLimit },
    { l: "Term", v: club.term },
    { l: "Cooldown", v: club.cooldown },
    { l: "Overdue penalty", v: club.overdue },
  ];
  return (
    <Card>
      <div className="flex items-center gap-3.5 border-b border-hr2 px-5 py-4.5">
        <span className="flex size-[50px] flex-none items-center justify-center rounded-15 bg-teal">
          <span className="flex size-5.5 items-center justify-center rounded-full bg-teal-dark">
            <span className="size-2.25 rounded-full bg-gold" />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-17 font-bold leading-115 text-ink">{club.name}</div>
          <div className="mt-1.5 text-xs font-medium leading-none text-fnt">{club.meta}</div>
        </div>
        {isAdmin && <EditClubButton edit={club.edit} className="rounded-lg border border-bd2 px-3.5 py-2.5 text-xs font-semibold leading-none text-teal hover:bg-tlsf" />}
      </div>
      <div className="flex border-b border-hr2">
        <div className="flex-1 border-r border-hr2 px-5 py-4">
          <div className="text-10 font-semibold uppercase leading-none tracking-6 text-fnt">Monthly deposit</div>
          <div className="mt-2.25 font-mono text-21 font-bold leading-none text-ink">{club.deposit}</div>
          <div className="mt-1.5 text-11 font-medium leading-none text-fnt">current stage</div>
        </div>
        <div className="flex-1 px-5 py-4">
          <div className="text-10 font-semibold uppercase leading-none tracking-6 text-fnt">Loan interest</div>
          <div className="mt-2.25 font-mono text-21 font-bold leading-none text-ink">{club.rate}</div>
          <div className="mt-1.5 text-11 font-medium leading-none text-fnt">new loans</div>
        </div>
      </div>
      <div className="border-b border-hr2 px-5 py-4">
        <div className="mb-3.75 text-11 font-semibold uppercase leading-none tracking-4 text-fnt">Loan rules</div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          {rules.map((r) => (
            <div key={r.l}>
              <div className="text-xs font-medium leading-none text-mut">{r.l}</div>
              <div className="mt-1.75 font-mono text-sm font-semibold leading-none text-ink">{r.v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between border-b border-hr2 px-5 py-3.5">
        <div>
          <div className="text-sm font-bold leading-none text-ink">Dividend distribution</div>
          <div className="mt-1 text-11 font-medium leading-none text-fnt">Profit accumulates in the club when off</div>
        </div>
        <span className="rounded-20 bg-nbg px-2.5 py-1.5 text-10 font-bold leading-none text-nfg">{club.dividend}</span>
      </div>
      <PenaltyRules penalty={club.penalty} />
      <div className="flex items-center justify-between border-b border-hr2 px-5 py-3.5">
        <span className="text-sm font-bold leading-none text-ink">Timezone</span>
        <span className="font-mono text-13 leading-none text-mut">{club.timezone}</span>
      </div>
      <RateDepositHistory history={club.history} />
    </Card>
  );
}

function PenaltyRules({ penalty }: { penalty: SettingsData["club"]["penalty"] }) {
  if (!penalty) return null; // cached pre-penalty /api/settings payload — hide the card until refetch
  const rows = [
    { l: "Deposit penalty", on: penalty.deposit.enabled, v: `${penalty.deposit.rate} on pending over ${penalty.deposit.min}`, sub: "charged on the 1st of each month" },
    { l: "Loan-interest penalty", on: penalty.interest.enabled, v: `${penalty.interest.rate} on interest over ${penalty.interest.min}`, sub: `${penalty.interest.grace} grace after a loan closes` },
  ];
  return (
    <div className="border-b border-hr2 px-5 py-4">
      <div className="mb-3.75 flex items-center justify-between">
        <span className="text-11 font-semibold uppercase leading-none tracking-4 text-fnt">Auto penalties</span>
        <span className="text-11 font-medium leading-none text-fnt">from {penalty.effectiveFrom}</span>
      </div>
      <div className="flex flex-col gap-3.5">
        {rows.map((r) => (
          <div key={r.l} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold leading-none text-ink">{r.l}</div>
              <div className="mt-1.5 text-11 font-medium leading-tight text-fnt">{r.on ? r.v : r.sub}</div>
            </div>
            <span className={`flex-none rounded-20 px-2.5 py-1.5 text-10 font-bold leading-none ${r.on ? "bg-tlsf text-teal" : "bg-nbg text-nfg"}`}>
              {r.on ? "On" : "Off"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RateDepositHistory({ history }: { history: SettingsData["club"]["history"] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left text-13 font-semibold leading-none text-teal hover:bg-tlsf"
      >
        Rate &amp; deposit history
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2.4} />
      </button>
      {open && (
        <div className="border-t border-hr2 px-5 py-4">
          <div className="mb-2.5 text-10 font-semibold uppercase leading-none tracking-6 text-fnt">Deposit stages</div>
          <div className="flex flex-col gap-2">
            {history.stages.map((s) => (
              <div key={s.range} className="flex items-center justify-between">
                <span className="font-mono text-13 font-semibold leading-none text-ink">{s.amount}</span>
                <span className="text-11 font-medium leading-none text-fnt">{s.range}</span>
              </div>
            ))}
          </div>

          <div className="mb-2.5 mt-4.5 text-10 font-semibold uppercase leading-none tracking-6 text-fnt">Loan interest schedule</div>
          <div className="flex flex-col gap-2">
            {history.rates.map((r) => (
              <div key={r.range} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-13 font-semibold leading-none text-ink">{r.rate}</span>
                  {r.current && (
                    <span className="rounded-md bg-tlsf px-1.5 py-1 text-9 font-bold uppercase leading-none tracking-5 text-teal">
                      Current
                    </span>
                  )}
                </span>
                <span className="text-11 font-medium leading-none text-fnt">{r.range}</span>
              </div>
            ))}
          </div>

          <div className="mt-4.5 flex items-center justify-between border-t border-hr2 pt-3.5">
            <span className="text-13 font-medium leading-none text-mut">Daily interest from</span>
            <span className="font-mono text-13 font-semibold leading-none text-ink">{history.dailyFrom}</span>
          </div>
          <div className="mt-3 text-11 font-medium leading-150 text-fnt">
            Rate changes apply to new loans only — existing loans keep the rate fixed at origination.
          </div>
        </div>
      )}
    </div>
  );
}
