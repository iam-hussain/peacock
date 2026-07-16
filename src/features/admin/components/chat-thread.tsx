"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { DateInput } from "@/components/shared/date-input";
import { usePageQuery } from "@/lib/use-page-query";
import type { MemberChat } from "@/server/queries/whatsapp-stats";

export interface ChatContact {
  id: string;
  name: string;
  phone: string;
}

/** One member's WhatsApp conversation: contact header, single-day filter, transcript bubbles
 *  (member left, bot replies right). Fills its parent — the desktop pane or the mobile takeover. */
export function ChatThread({ contact }: { contact: ChatContact }) {
  const [date, setDate] = useState(""); // "" = most recent
  const url = `/api/admin/chats?member=${encodeURIComponent(contact.id)}${date ? `&date=${date}` : ""}`;
  const { data: chat, error, isLoading } = usePageQuery<MemberChat>(["admin-chat", contact.id, date], url);

  // A chat opens at its latest message (transcript is oldest → newest).
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [chat]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none flex-wrap items-center gap-x-3 gap-y-2 border-b border-hr2 px-4 py-3">
        <Avatar name={contact.name} size={34} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-13 font-bold leading-none text-ink">{contact.name}</div>
          <div className="mt-1 font-mono text-11 font-medium leading-none text-fnt">{contact.phone}</div>
        </div>
        <div className="flex flex-none items-center gap-2">
          <div className="w-40">
            <DateInput name="chat-date" value={date} onChange={setDate} />
          </div>
          {date && (
            <button type="button" onClick={() => setDate("")} className="text-12 font-semibold leading-none text-teal">
              Clear
            </button>
          )}
        </div>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-bg2 p-3.5">
        {isLoading ? (
          <p className="py-12 text-center text-12 font-medium text-mut">Loading…</p>
        ) : error ? (
          <p className="py-12 text-center text-12 font-medium text-out">
            {error instanceof Error ? error.message : "Could not load the chat."}
          </p>
        ) : !chat?.messages.length ? (
          <p className="py-12 text-center text-12 font-medium text-mut">No messages {date ? "on this day" : "yet"}.</p>
        ) : (
          chat.messages.map((m, i) => <Bubble key={i} m={m} />)
        )}
      </div>
    </div>
  );
}

function Bubble({ m }: { m: MemberChat["messages"][number] }) {
  const out = m.direction === "OUT";
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 ${
          out ? "rounded-br-sm bg-teal text-white" : "rounded-bl-sm border border-bd bg-sf text-ink"
        }`}
      >
        {m.hasMedia && (
          <span className={`mb-1 inline-flex items-center gap-1 text-10 font-semibold ${out ? "text-white/80" : "text-fnt"}`}>
            <ImageIcon className="size-3" strokeWidth={2} /> image
          </span>
        )}
        {m.text ? (
          <p className="whitespace-pre-wrap break-words text-12 font-medium leading-140">{m.text}</p>
        ) : (
          <p className={`text-12 italic leading-140 ${out ? "text-white/70" : "text-mut"}`}>
            {m.hasMedia ? "(image)" : `(${m.kind})`}
          </p>
        )}
        <div className={`mt-1 text-9 font-medium leading-none ${out ? "text-white/70" : "text-fnt"}`}>{m.at}</div>
      </div>
    </div>
  );
}
