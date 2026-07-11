"use client";

import { Toggle } from "./settings-primitives";
import { DateInput } from "@/components/shared/date-input";
import type { SettingsData } from "@/server/queries/settings";

// The editable auto-penalty state carried by the Edit-club modal. Mirrors PenaltyInput on the server.
export type PenaltyState = SettingsData["club"]["edit"]["penalty"];

const label = "text-11 font-bold uppercase leading-none tracking-6 text-fnt";
const input =
  "w-full rounded-11 border border-bd2 bg-sf px-3.5 py-2.5 text-sm font-medium text-ink outline-none placeholder:text-fnt focus:border-teal";

/** The two auto-penalty rules in the Edit-club modal (§13.2): a shared start date, then an on/off +
 *  rate + minimum for each, plus a grace window for the loan-interest penalty. */
export function PenaltyFields({ value, onChange }: { value: PenaltyState; onChange: (v: PenaltyState) => void }) {
  const set = <K extends keyof PenaltyState>(k: K, v: PenaltyState[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="flex flex-col gap-4 rounded-13 border border-bd px-4 py-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold leading-none text-ink">Auto penalties</div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={label}>Apply from</span>
        <DateInput value={value.from} onChange={(v) => set("from", v)} />
        <span className="text-11 font-medium leading-150 text-fnt">Nothing is charged before this date. Both penalties share it.</span>
      </div>

      <Rule
        title="Deposit penalty"
        hint="On the 1st of each month, charged on the deposit still pending."
        on={value.depositEnabled}
        onToggle={(v) => set("depositEnabled", v)}
        rate={value.depositRate}
        onRate={(v) => set("depositRate", v)}
        min={value.depositMin}
        onMin={(v) => set("depositMin", v)}
        minLabel="Only over ₹"
      />

      <Rule
        title="Loan-interest penalty"
        hint="After a loan closes with interest unpaid, charged every grace window on the interest pending."
        on={value.interestEnabled}
        onToggle={(v) => set("interestEnabled", v)}
        rate={value.interestRate}
        onRate={(v) => set("interestRate", v)}
        min={value.interestMin}
        onMin={(v) => set("interestMin", v)}
        minLabel="Only over ₹"
        grace={value.interestGrace}
        onGrace={(v) => set("interestGrace", v)}
      />
    </div>
  );
}

function Rule(props: {
  title: string; hint: string; on: boolean; onToggle: (v: boolean) => void;
  rate: string; onRate: (v: string) => void; min: string; onMin: (v: string) => void; minLabel: string;
  grace?: string; onGrace?: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-hr2 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-13 font-bold leading-none text-ink">{props.title}</div>
          <div className="mt-1.5 text-11 font-medium leading-tight text-fnt">{props.hint}</div>
        </div>
        <Toggle on={props.on} onChange={props.onToggle} />
      </div>
      {props.on && (
        <div className={`grid gap-3 ${props.onGrace ? "grid-cols-3" : "grid-cols-2"}`}>
          <Field label="Rate % / mo">
            <input className={input} inputMode="decimal" value={props.rate} onChange={(e) => props.onRate(e.target.value)} />
          </Field>
          <Field label={props.minLabel}>
            <input className={input} inputMode="decimal" value={props.min} onChange={(e) => props.onMin(e.target.value)} />
          </Field>
          {props.onGrace && (
            <Field label="Grace days">
              <input className={input} inputMode="numeric" value={props.grace} onChange={(e) => props.onGrace!(e.target.value)} />
            </Field>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label: l, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-10 font-bold uppercase leading-none tracking-4 text-fnt">{l}</span>
      {children}
    </label>
  );
}
