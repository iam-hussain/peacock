"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, MessageSquareOff, MessagesSquare, PhoneOff, Users } from "lucide-react";
import { ChatList } from "./chat-list";
import { ChatThread } from "./chat-thread";
import type { MemberUsage, WhatsappStats } from "@/server/queries/whatsapp-stats";

/** Admin WhatsApp inbox — usage stats up top, then a two-pane chat browser: every conversation on
 *  the left (members, silent, unknown numbers), the selected member's transcript on the right
 *  (desktop) or as a full-screen takeover (mobile). */
export function ChatStats({ data }: { data: WhatsappStats }) {
  const [selected, setSelected] = useState<MemberUsage | null>(null);
  const t = data.totals;

  return (
    <div className="mx-auto max-w-320 p-4 pb-19.5 md:p-6.5 md:pb-6.5">
      <div className="mb-5">
        <Link href="/admin" className="mb-3 inline-flex items-center gap-1.5 text-12 font-semibold text-mut hover:text-ink">
          <ArrowLeft className="size-3.5" strokeWidth={2.2} /> Admin
        </Link>
        <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">WhatsApp chats</h1>
        <p className="mt-1.75 text-13 font-medium leading-140 text-mut">
          Every conversation with the club assistant — who&apos;s using it, who&apos;s silent, and any unknown numbers.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Tile icon={MessageSquare} value={t.messages} label="messages" sub={`${t.inbound} in · ${t.outbound} out`} />
        <Tile icon={Users} value={`${t.using}/${t.members}`} label="members active" tone="teal" />
        <Tile icon={MessageSquareOff} value={t.notUsing} label="not yet using" tone={t.notUsing ? "warn" : "mut"} />
        <Tile icon={PhoneOff} value={t.unregistered} label="unknown numbers" tone={t.unregistered ? "warn" : "mut"} />
      </div>

      {t.capped && (
        <p className="mb-4 rounded-xl border border-bd bg-bg2 px-3.5 py-2.5 text-12 font-medium leading-140 text-mut">
          Showing the most recent messages — older activity beyond the window isn&apos;t counted in these tallies.
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-card lg:grid lg:h-150 lg:grid-cols-[340px_1fr]">
        <ChatList data={data} selectedId={selected?.id} onSelect={setSelected} />
        <div className="hidden min-h-0 border-l border-hr2 lg:flex lg:flex-col">
          {selected ? <ChatThread key={selected.id} contact={selected} /> : <ThreadEmpty />}
        </div>
      </div>

      {/* Mobile: the thread takes over the screen (WhatsApp-style), CSS-only split — the desktop
          pane above is hidden below lg, this overlay is hidden at lg. */}
      {selected && (
        <div className="fixed inset-0 z-50 flex flex-col bg-sf lg:hidden">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="flex flex-none items-center gap-1.5 border-b border-hr2 px-4 py-3 text-left text-12 font-semibold leading-none text-mut transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2.2} /> All chats
          </button>
          <ChatThread key={selected.id} contact={selected} />
        </div>
      )}
    </div>
  );
}

function ThreadEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 bg-bg2 px-6 text-center">
      <MessagesSquare className="size-7 text-mut" strokeWidth={1.6} />
      <p className="text-13 font-semibold leading-none text-ink">Pick a conversation</p>
      <p className="max-w-60 text-12 font-medium leading-140 text-mut">
        Select a member on the left to read their chat with the club assistant.
      </p>
    </div>
  );
}

const TONE: Record<string, string> = { ink: "text-ink", teal: "text-teal", warn: "text-wfg", mut: "text-mut" };

function Tile({
  icon: Icon,
  value,
  label,
  sub,
  tone = "ink",
}: {
  icon: typeof Users;
  value: string | number;
  label: string;
  sub?: string;
  tone?: "ink" | "teal" | "warn" | "mut";
}) {
  return (
    <div className="rounded-2xl border border-bd bg-sf px-4 py-3.5 shadow-card">
      <Icon className={`size-4.5 ${TONE[tone]}`} strokeWidth={2} />
      <div className={`mt-2 font-mono text-xl font-bold leading-none ${TONE[tone]}`}>{value}</div>
      <div className="mt-1.5 text-10 font-semibold uppercase leading-none tracking-3 text-fnt">{label}</div>
      {sub && <div className="mt-1.5 text-11 font-medium leading-none text-mut">{sub}</div>}
    </div>
  );
}
