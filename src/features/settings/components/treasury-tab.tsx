import { Vault } from "lucide-react";
import { initials } from "@/lib/avatar";
import { Card } from "./settings-primitives";
import type { SettingsData } from "@/server/queries/settings";

export function TreasuryTab({ treasury }: { treasury: SettingsData["treasury"] }) {
  return (
    <Card>
      <div className="flex items-center gap-3 border-b border-hr2 px-5 py-4.5">
        <span className="flex size-10 flex-none items-center justify-center rounded-11 bg-tlsf text-teal">
          <Vault className="size-[19px]" strokeWidth={2} />
        </span>
        <div className="flex-1">
          <div className="text-base font-bold leading-110 text-ink">Treasury &amp; cash holdings</div>
          <div className="mt-1 text-xs font-medium leading-130 text-fnt">
            The club has no account of its own — these members hold its cash.
          </div>
        </div>
      </div>
      <div className="px-5 py-4">
        <div className="flex flex-col gap-2.5">
          {treasury.map((t) => (
            <div key={t.name} className="flex items-center gap-3 rounded-13 border border-bd px-3.75 py-3.5">
              <span className="flex size-10 flex-none items-center justify-center rounded-full bg-teal text-13 font-bold text-white">
                {initials(t.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold leading-none text-ink">{t.name}</div>
                <div className="mt-1 text-11 font-medium leading-none text-fnt">Holds club cash · belongs to the club</div>
              </div>
              <span className="font-mono text-15 font-semibold leading-none text-ink">{t.holds}</span>
            </div>
          ))}
        </div>
        <div className="mt-3.5 rounded-xl bg-tlsf px-3.5 py-3.25 text-xs font-medium leading-150 text-mut">
          Holding cash is <span className="font-semibold text-ink">automatic</span> — anyone listed on an entry as the
          holder shows up here. There&apos;s no setting to make someone a treasurer.
        </div>
      </div>
    </Card>
  );
}
