"use client";

import { PhoneOff } from "lucide-react";
import type { UnregisteredNumber } from "@/server/queries/whatsapp-stats";

/** Unknown numbers that have messaged the bot (no matching member) — count + latest preview, so an
 *  admin can spot a new member to register or a wrong number to ignore. */
export function ChatUnregisteredList({ rows }: { rows: UnregisteredNumber[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-card">
      <div className="flex items-center justify-between border-b border-hr2 px-4.5 py-3">
        <span className="text-13 font-bold leading-none text-ink">Unregistered numbers</span>
        <span className="rounded-20 bg-bg2 px-2 py-1 text-10 font-bold leading-none text-mut">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4.5 py-8 text-center">
          <PhoneOff className="size-6 text-mut" strokeWidth={1.6} />
          <span className="text-12 font-medium leading-140 text-mut">No unknown numbers have messaged the club.</span>
        </div>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.waId} className="flex items-center gap-3 border-b border-hr2 px-4.5 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-13 font-semibold leading-tight text-ink">…{r.waId}</div>
                {r.lastPreview && <div className="mt-0.5 truncate text-11 font-medium leading-tight text-fnt">{r.lastPreview}</div>}
              </div>
              <div className="flex-none text-right">
                <div className="font-mono text-13 font-bold leading-none text-wfg">{r.count}</div>
                <div className="mt-1 text-9 font-medium leading-none text-fnt">{r.lastAt}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
