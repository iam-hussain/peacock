"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayIso = () => {
  const n = new Date();
  return isoOf(n.getFullYear(), n.getMonth(), n.getDate());
};

/** Themed calendar replacing the unstylable native `<input type="date">`: field-styled
 * trigger, Radix popover (portalled + collision-aware), month-stepped day grid with big
 * touch targets and a Today shortcut. `name` renders a hidden input for FormData forms. */
export function DateInput({
  value,
  onChange,
  name,
  required,
}: {
  value: string; // ISO "2026-07-07" or ""
  onChange?: (v: string) => void;
  name?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState(value); // uncontrolled fallback when only `name` is given
  const v = onChange ? value : inner;
  const set = (next: string) => {
    onChange?.(next);
    setInner(next);
    setOpen(false);
  };

  const today = todayIso();
  const base = v || today;
  const [view, setView] = useState(() => ({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 }));
  const step = (d: number) =>
    setView(({ y, m }) => ({ y: y + Math.floor((m + d) / 12), m: (((m + d) % 12) + 12) % 12 }));

  const firstDay = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();

  return (
    <>
      {name && <input type="hidden" name={name} value={v} required={required} />}
      <Popover
        open={open}
        onOpenChange={(o) => {
          if (o && v) setView({ y: Number(v.slice(0, 4)), m: Number(v.slice(5, 7)) - 1 });
          setOpen(o);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm font-medium outline-none transition-colors focus:border-teal ${
              v ? "border-teal text-ink" : "border-bd2 text-fnt"
            }`}
          >
            <span className="truncate">
              {v ? `${pad(Number(v.slice(8, 10)))} ${MON[Number(v.slice(5, 7)) - 1]} ${v.slice(0, 4)}` : "Pick a date"}
            </span>
            <CalendarDays className="size-4 flex-none text-mut" strokeWidth={2} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[292px]">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous month"
              className="flex size-8 items-center justify-center rounded-lg text-mut hover:bg-bg2 hover:text-ink"
            >
              <ChevronLeft className="size-4" strokeWidth={2.2} />
            </button>
            <span className="text-sm font-bold leading-none text-ink">
              {MON[view.m]} {view.y}
            </span>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next month"
              className="flex size-8 items-center justify-center rounded-lg text-mut hover:bg-bg2 hover:text-ink"
            >
              <ChevronRight className="size-4" strokeWidth={2.2} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-1 text-center text-10 font-semibold uppercase tracking-4 text-mut">
                {d}
              </span>
            ))}
            {Array.from({ length: firstDay }, (_, i) => (
              <span key={`b${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const iso = isoOf(view.y, view.m, i + 1);
              const selected = iso === v;
              const isToday = iso === today;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => set(iso)}
                  className={`flex size-9 items-center justify-center rounded-10 text-13 font-semibold leading-none transition-colors ${
                    selected ? "bg-teal text-white" : isToday ? "bg-tlsf text-teal" : "text-ink hover:bg-bg2"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => set(today)}
            className="mt-2 w-full rounded-10 py-2 text-13 font-semibold leading-none text-teal hover:bg-tlsf"
          >
            Today
          </button>
        </PopoverContent>
      </Popover>
    </>
  );
}
