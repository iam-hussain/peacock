"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChipOption {
  value: string;
  label: string;
  /** optional colored role dot */
  dot?: string;
}

/** A filter chip that opens a dropdown of options. Keeps the existing chip styling. */
export function ChipMenu({
  label,
  options,
  value,
  onChange,
  searchable = false,
  align = "left",
}: {
  label: string;
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
  searchable?: boolean;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);
  const shown = searchable && q.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase()))
    : options;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-bd2 px-3 py-2.25 text-xs font-semibold leading-none text-mut hover:bg-sf2"
      >
        {current?.label ?? label}
        <ChevronDown className={cn("size-3 text-fnt transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-20 mt-1.5 max-h-72 w-56 overflow-auto rounded-xl border border-bd bg-sf p-1.5 shadow-[0_8px_24px_var(--shadow)]",
            align === "right" ? "right-0" : "left-0",
          )}
          role="listbox"
        >
          {searchable && (
            <div className="mb-1 flex items-center gap-2 rounded-lg border border-bd2 px-2.5">
              <Search className="size-3.25 flex-none text-fnt" strokeWidth={2} />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="min-w-0 flex-1 bg-transparent py-2 text-13 font-medium text-ink outline-none placeholder:text-fnt"
              />
            </div>
          )}
          {shown.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
                setQ("");
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-13 font-semibold leading-none hover:bg-sf2",
                o.value === value ? "text-teal" : "text-ink",
              )}
            >
              {o.dot && <span className={cn("size-1.75 flex-none rounded-full", o.dot)} />}
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.value === value && <Check className="size-3.75 flex-none text-teal" strokeWidth={2.5} />}
            </button>
          ))}
          {shown.length === 0 && (
            <div className="px-2.5 py-3 text-center text-xs font-medium text-fnt">No matches</div>
          )}
        </div>
      )}
    </div>
  );
}
