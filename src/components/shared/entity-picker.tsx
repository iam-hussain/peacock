"use client";

import { useMemo, useState } from "react";
import { Search, ChevronLeft, HelpCircle } from "lucide-react";
import { Avatar } from "./avatar";

export type PickBadgeTone = "eligible" | "high" | "med" | "low" | "warn";
export interface PickOption {
  id: string;
  name: string;
  sub?: string;
  avatar?: string | null; // member photo (data URL); falls back to initials when absent
  badge?: string; // small chip beside the name (e.g. loan priority / eligibility)
  badgeTone?: PickBadgeTone;
}

const BADGE_TONES: Record<PickBadgeTone, string> = {
  eligible: "bg-tlsf text-teal",
  high: "bg-tlsf text-teal",
  med: "bg-bg2 text-mut",
  low: "bg-nbg text-nfg",
  warn: "bg-wbg text-wfg",
};

/** Small pill for a PickOption's priority / eligibility hint. */
export function PickBadge({ text, tone = "med" }: { text: string; tone?: PickBadgeTone }) {
  return (
    <span className={`flex-none rounded-md px-1.75 py-0.75 text-9 font-bold uppercase leading-none tracking-4 ${BADGE_TONES[tone]}`}>
      {text}
    </span>
  );
}

/** A "choose an entity" card — dashed placeholder, or the selected entity with a Change link. */
export function SelectorCard({
  selected,
  placeholder,
  hint,
  onOpen,
}: {
  selected: PickOption | null;
  placeholder: string;
  hint: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border border-dashed border-bd2 px-3.5 py-3 text-left transition-colors hover:border-teal"
    >
      {selected ? (
        <Avatar name={selected.name} src={selected.avatar} size={38} muted />
      ) : (
        <span className="flex size-9.5 flex-none items-center justify-center rounded-full border border-dashed border-bd2 text-fnt">
          <HelpCircle className="size-4.5" strokeWidth={2} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-bold leading-tight text-ink">{selected ? selected.name : placeholder}</div>
        <div className="mt-0.5 truncate text-12 font-medium leading-tight text-fnt">{selected ? selected.sub ?? "" : hint}</div>
      </div>
      <span className="flex-none text-13 font-semibold text-teal">{selected ? "Change" : "Select"}</span>
    </button>
  );
}

/** Full-screen picker sub-view: back header, search, scrollable entity list. */
export function PickerSheet({
  title,
  subtitle,
  searchPlaceholder,
  options,
  onPick,
  onBack,
}: {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  options: PickOption[];
  onPick: (o: PickOption) => void;
  onBack: () => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.name.toLowerCase().includes(s)) : options;
  }, [q, options]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 pb-3.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex size-9 flex-none items-center justify-center rounded-10 border border-bd2 text-ink hover:bg-bg2"
        >
          <ChevronLeft className="size-4.5" strokeWidth={2.2} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold leading-tight text-ink">{title}</h2>
          <p className="mt-1 text-xs font-medium leading-140 text-fnt">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-11 border border-bd2 px-3">
        <Search className="size-3.75 flex-none text-fnt" strokeWidth={2} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          autoFocus
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm font-medium text-ink outline-none placeholder:text-fnt"
        />
      </div>

      <div className="mt-1.5 flex-1 overflow-y-auto">
        {list.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o)}
            className="flex w-full items-center gap-3 border-b border-hr2 py-3 text-left last:border-b-0 hover:bg-bg2"
          >
            <Avatar name={o.name} src={o.avatar} size={38} muted />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-bold leading-tight text-ink">{o.name}</span>
                {o.badge && <PickBadge text={o.badge} tone={o.badgeTone} />}
              </div>
              {o.sub && <div className="mt-0.5 truncate text-12 font-medium leading-tight text-fnt">{o.sub}</div>}
            </div>
          </button>
        ))}
        {list.length === 0 && <div className="py-8 text-center text-13 font-medium text-fnt">No matches.</div>}
      </div>
    </div>
  );
}
