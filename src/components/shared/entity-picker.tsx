"use client";

import { forwardRef, useMemo, useState } from "react";
import { Search, HelpCircle } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
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

/** A "choose an entity" card — dashed placeholder, or the selected entity with a Change link.
 * Ref-forwarding so it can be a Radix popover trigger. */
export const SelectorCard = forwardRef<
  HTMLButtonElement,
  {
    selected: PickOption | null;
    placeholder: string;
    hint: string;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function SelectorCard({ selected, placeholder, hint, ...props }, ref) {
  return (
    <button
      type="button"
      ref={ref}
      {...props}
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
});

/** Entity selection as a combobox: the SelectorCard opens a portalled popover with a
 * search box and the option list — no sub-screen, works the same in every dialog. */
export function EntityPicker({
  selected,
  onPick,
  options,
  placeholder,
  hint,
  searchPlaceholder = "Search…",
}: {
  selected: PickOption | null;
  onPick: (o: PickOption) => void;
  options: PickOption[];
  placeholder: string;
  hint: string;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.name.toLowerCase().includes(s)) : options;
  }, [q, options]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) setQ("");
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <SelectorCard selected={selected} placeholder={placeholder} hint={hint} />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[var(--radix-popover-trigger-width)] p-2">
        <div className="flex items-center gap-2 rounded-10 border border-bd2 px-3">
          <Search className="size-3.75 flex-none text-fnt" strokeWidth={2} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            autoFocus
            className="min-w-0 flex-1 bg-transparent py-2.25 text-sm font-medium text-ink outline-none placeholder:text-fnt"
          />
        </div>
        <div className="mt-1 max-h-[40vh] overflow-y-auto">
          {list.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onPick(o);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 rounded-10 px-2 py-2 text-left transition-colors hover:bg-bg2 ${
                selected?.id === o.id ? "bg-tlsf/50" : ""
              }`}
            >
              <Avatar name={o.name} src={o.avatar} size={32} muted />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-13 font-bold leading-tight text-ink">{o.name}</span>
                  {o.badge && <PickBadge text={o.badge} tone={o.badgeTone} />}
                </div>
                {o.sub && <div className="mt-0.5 truncate text-11 font-medium leading-tight text-fnt">{o.sub}</div>}
              </div>
            </button>
          ))}
          {list.length === 0 && <div className="py-6 text-center text-13 font-medium text-fnt">No matches.</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
