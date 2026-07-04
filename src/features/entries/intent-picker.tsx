"use client";

import { ChevronRight } from "lucide-react";
import { GROUPS, DIR_META, type Intent } from "./entry-constants";

export function IntentPicker({ onPick }: { onPick: (label: string) => void }) {
  return (
    <div className="flex flex-col gap-5">
      {GROUPS.map((g) => (
        <div key={g.name}>
          <div className="flex items-center gap-3">
            <span className="text-11 font-bold uppercase leading-none tracking-6 text-fnt">{g.name}</span>
            <span className="h-px flex-1 bg-hair" />
          </div>
          <div className="mt-2.5 flex flex-col gap-2">
            {g.items.map((it) => (
              <IntentRow key={it.label} it={it} onPick={() => onPick(it.label)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function IntentRow({ it, onPick }: { it: Intent; onPick: () => void }) {
  const m = DIR_META[it.dir];
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-3.5 rounded-xl border border-bd2 bg-sf px-3.5 py-3 text-left transition-colors hover:border-teal hover:bg-tlsf"
    >
      <span className={`flex size-10 flex-none items-center justify-center rounded-10 ${m.tile}`}>
        <m.Icon className={`size-4.5 ${m.color}`} strokeWidth={2.4} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-15 font-bold leading-tight text-ink">{it.label}</div>
        <div className="mt-0.5 text-12 font-medium leading-135 text-fnt">{it.desc}</div>
      </div>
      <span className={`flex-none text-11 font-bold uppercase tracking-4 ${m.color}`}>{m.badge}</span>
      <ChevronRight className="size-4 flex-none text-fnt" strokeWidth={2} />
    </button>
  );
}
