"use client";

import { Eye, EyeOff } from "lucide-react";
import { LOAN_FILTERS } from "../data";

export function Filters({
  filter,
  onChange,
  showClosedMembers,
  onToggleClosedMembers,
  className = "",
}: {
  filter: string;
  onChange: (f: string) => void;
  showClosedMembers: boolean;
  onToggleClosedMembers: () => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 overflow-x-auto ${className}`}>
      {LOAN_FILTERS.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          aria-pressed={filter === f}
          className={`whitespace-nowrap rounded-8 border px-3.5 py-2 text-12 font-semibold leading-none transition-colors ${
            filter === f ? "border-teal/40 bg-tlsf text-teal" : "border-bd2 bg-sf text-mut"
          }`}
        >
          {f}
        </button>
      ))}
      <button
        onClick={onToggleClosedMembers}
        aria-pressed={showClosedMembers}
        className={`ml-auto flex items-center gap-1.5 whitespace-nowrap rounded-8 border px-3.5 py-2 text-12 font-semibold leading-none transition-colors ${
          showClosedMembers ? "border-teal/40 bg-tlsf text-teal" : "border-bd2 bg-sf text-mut"
        }`}
      >
        {showClosedMembers ? <Eye className="size-3.5" strokeWidth={2.5} /> : <EyeOff className="size-3.5" strokeWidth={2.5} />}
        Closed members
      </button>
    </div>
  );
}
