"use client";

import { ChevronRight } from "lucide-react";
import type { MemberUsage } from "@/server/queries/whatsapp-stats";

/** A card listing members and their bot usage. Shared by the "active" and "not using yet" columns;
 *  each row opens that member's conversation. */
export function ChatUsageList({
  title,
  rows,
  empty,
  onSelect,
  muted = false,
}: {
  title: string;
  rows: MemberUsage[];
  empty: string;
  onSelect: (m: { id: string; name: string }) => void;
  muted?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-card">
      <div className="flex items-center justify-between border-b border-hr2 px-4.5 py-3">
        <span className="text-13 font-bold leading-none text-ink">{title}</span>
        <span className="rounded-20 bg-bg2 px-2 py-1 text-10 font-bold leading-none text-mut">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="px-4.5 py-8 text-center text-12 font-medium leading-140 text-mut">{empty}</div>
      ) : (
        <ul>
          {rows.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onSelect({ id: m.id, name: m.name })}
                className="flex w-full items-center gap-3 border-b border-hr2 px-4.5 py-3 text-left transition-colors last:border-b-0 hover:bg-bg2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-13 font-semibold leading-tight text-ink">{m.name}</span>
                    {m.isAdmin && <Tag>admin</Tag>}
                    {!m.isActive && <Tag tone="mut">inactive</Tag>}
                  </div>
                  <div className="mt-0.5 truncate text-11 font-medium leading-tight text-fnt">
                    {muted ? m.phone : (m.lastPreview ?? m.phone)}
                  </div>
                </div>
                <div className="flex-none text-right">
                  {muted ? (
                    <span className="text-11 font-medium text-mut">never</span>
                  ) : (
                    <>
                      <div className="font-mono text-13 font-bold leading-none text-teal">{m.inbound}</div>
                      <div className="mt-1 text-9 font-medium leading-none text-fnt">{m.lastAt}</div>
                    </>
                  )}
                </div>
                <ChevronRight className="size-4 flex-none text-fnt" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tag({ children, tone = "teal" }: { children: React.ReactNode; tone?: "teal" | "mut" }) {
  return (
    <span
      className={`rounded-20 px-1.5 py-0.5 text-8 font-bold uppercase leading-none tracking-3 ${
        tone === "teal" ? "bg-tlsf text-teal" : "bg-nbg text-nfg"
      }`}
    >
      {children}
    </span>
  );
}
