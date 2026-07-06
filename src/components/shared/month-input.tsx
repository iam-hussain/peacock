"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Themed month picker replacing the unstylable native `<input type="month">`:
 * field-styled trigger, Radix popover (portalled + collision-aware) with a year
 * stepper and month grid. `name` renders a hidden input for plain FormData forms. */
export function MonthInput({
  value,
  onChange,
  name,
  required,
}: {
  value: string; // "2026-07" or ""
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
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, setYear] = useState(() => Number((v || thisMonth).slice(0, 4)));
  const selYear = v ? Number(v.slice(0, 4)) : null;
  const selMonth = v ? Number(v.slice(5, 7)) : null;

  return (
    <>
      {name && <input type="hidden" name={name} value={v} required={required} />}
      <Popover
        open={open}
        onOpenChange={(o) => {
          if (o && v) setYear(Number(v.slice(0, 4)));
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
            <span className="truncate">{v ? `${MON[Number(v.slice(5, 7)) - 1]} ${v.slice(0, 4)}` : "Pick a month"}</span>
            <CalendarDays className="size-4 flex-none text-mut" strokeWidth={2} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[276px]">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              aria-label="Previous year"
              className="flex size-8 items-center justify-center rounded-lg text-mut hover:bg-bg2 hover:text-ink"
            >
              <ChevronLeft className="size-4" strokeWidth={2.2} />
            </button>
            <span className="text-sm font-bold leading-none text-ink">{year}</span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              aria-label="Next year"
              className="flex size-8 items-center justify-center rounded-lg text-mut hover:bg-bg2 hover:text-ink"
            >
              <ChevronRight className="size-4" strokeWidth={2.2} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {MON.map((m, i) => {
              const key = `${year}-${String(i + 1).padStart(2, "0")}`;
              const selected = selYear === year && selMonth === i + 1;
              const current = key === thisMonth;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => set(key)}
                  className={`rounded-10 py-2.5 text-13 font-semibold leading-none transition-colors ${
                    selected ? "bg-teal text-white" : current ? "bg-tlsf text-teal" : "text-ink hover:bg-bg2"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              setYear(now.getFullYear());
              set(thisMonth);
            }}
            className="mt-2 w-full rounded-10 py-2 text-13 font-semibold leading-none text-teal hover:bg-tlsf"
          >
            This month
          </button>
        </PopoverContent>
      </Popover>
    </>
  );
}
