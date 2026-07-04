"use client";

import { Rows3, LayoutGrid, type LucideIcon } from "lucide-react";

export type ListView = "cards" | "table";

/** Card ↔ table view switch (grid icon = cards, rows icon = table — matches convention). */
export function ViewToggle({ value, onChange }: { value: ListView; onChange: (v: ListView) => void }) {
  return (
    <div className="flex flex-none items-center gap-1 rounded-10 border border-bd2 bg-bg2 p-1">
      <Button active={value === "table"} onClick={() => onChange("table")} icon={Rows3} label="Table view" />
      <Button active={value === "cards"} onClick={() => onChange("cards")} icon={LayoutGrid} label="Card view" />
    </div>
  );
}

function Button({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: LucideIcon; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex size-7 items-center justify-center rounded-7 transition-colors ${
        active ? "bg-sf text-teal shadow-card" : "text-mut"
      }`}
    >
      <Icon className="size-4" strokeWidth={2.2} />
    </button>
  );
}
