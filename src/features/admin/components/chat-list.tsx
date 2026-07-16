"use client";

import { useMemo, useState } from "react";
import { PhoneOff, Search } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import type { MemberUsage, UnregisteredNumber, WhatsappStats } from "@/server/queries/whatsapp-stats";

/** The inbox rail: search + every conversation grouped into Chats (members who've messaged, busiest
 *  first), Silent (registered, never messaged), and Unknown numbers (no matching member, read-only). */
export function ChatList({
  data,
  selectedId,
  onSelect,
}: {
  data: WhatsappStats;
  selectedId?: string;
  onSelect: (m: MemberUsage) => void;
}) {
  const [q, setQ] = useState("");

  const [using, notUsing, unregistered] = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hit = (m: MemberUsage) => !needle || m.name.toLowerCase().includes(needle) || m.phone.includes(needle);
    return [
      data.using.filter(hit),
      data.notUsing.filter(hit),
      data.unregistered.filter((r) => !needle || r.waId.includes(needle)),
    ] as const;
  }, [data, q]);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex-none border-b border-hr2 p-3">
        <div className="flex items-center gap-2.25 rounded-11 border border-bd2 bg-bg2 px-3 py-2.25">
          <Search className="size-3.75 flex-none text-fnt" strokeWidth={2} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or number"
            className="min-w-0 flex-1 bg-transparent text-13 font-medium text-ink outline-none placeholder:text-fnt"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 lg:overflow-y-auto">
        {using.length > 0 && <SectionLabel>Chats · {using.length}</SectionLabel>}
        {using.map((m) => (
          <MemberRow key={m.id} m={m} selected={m.id === selectedId} onSelect={onSelect} />
        ))}

        {notUsing.length > 0 && <SectionLabel>Silent · {notUsing.length}</SectionLabel>}
        {notUsing.map((m) => (
          <MemberRow key={m.id} m={m} selected={m.id === selectedId} onSelect={onSelect} muted />
        ))}

        {unregistered.length > 0 && <SectionLabel>Unknown numbers · {unregistered.length}</SectionLabel>}
        {unregistered.map((r) => (
          <UnknownRow key={r.waId} r={r} />
        ))}

        {using.length + notUsing.length + unregistered.length === 0 && (
          <p className="px-4 py-10 text-center text-12 font-medium leading-140 text-mut">
            {q ? "Nothing matches your search." : "No conversations yet — the bot hasn't received a message."}
          </p>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-hr2 bg-bg2/60 px-4 pb-2 pt-3 text-10 font-bold uppercase leading-none tracking-3 text-fnt">
      {children}
    </div>
  );
}

function MemberRow({
  m,
  selected,
  onSelect,
  muted = false,
}: {
  m: MemberUsage;
  selected: boolean;
  onSelect: (m: MemberUsage) => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(m)}
      className={`flex w-full items-center gap-3 border-b border-hr2 px-4 py-3 text-left transition-colors ${
        selected ? "bg-tlsf" : "hover:bg-bg2"
      }`}
    >
      <Avatar name={m.name} size={38} muted={muted} />
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
          <span className="text-11 font-medium leading-none text-mut">never</span>
        ) : (
          <>
            <span className="inline-block rounded-20 bg-tlsf px-1.75 py-1 font-mono text-11 font-bold leading-none text-teal">
              {m.inbound}
            </span>
            <div className="mt-1 text-9 font-medium leading-none text-fnt">{m.lastAt}</div>
          </>
        )}
      </div>
    </button>
  );
}

/** Unknown numbers have no member to open — informational row only. */
function UnknownRow({ r }: { r: UnregisteredNumber }) {
  return (
    <div className="flex w-full items-center gap-3 border-b border-hr2 px-4 py-3">
      <div className="flex size-9.5 flex-none items-center justify-center rounded-full bg-wbg">
        <PhoneOff className="size-4 text-wfg" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-13 font-semibold leading-tight text-ink">…{r.waId}</div>
        {r.lastPreview && <div className="mt-0.5 truncate text-11 font-medium leading-tight text-fnt">{r.lastPreview}</div>}
      </div>
      <div className="flex-none text-right">
        <span className="inline-block rounded-20 bg-wbg px-1.75 py-1 font-mono text-11 font-bold leading-none text-wfg">
          {r.count}
        </span>
        <div className="mt-1 text-9 font-medium leading-none text-fnt">{r.lastAt}</div>
      </div>
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
