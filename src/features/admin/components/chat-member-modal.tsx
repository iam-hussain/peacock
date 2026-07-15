"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { Modal } from "@/components/shared/modal";
import { DateInput } from "@/components/shared/date-input";
import { usePageQuery } from "@/lib/use-page-query";
import type { MemberChat } from "@/server/queries/whatsapp-stats";

/** Reads one member's WhatsApp conversation, with an optional single-day filter ("cibi on 15 Jul").
 *  Inbound messages sit left, bot replies right — a familiar chat transcript. */
export function ChatMemberModal({ member, onClose }: { member: { id: string; name: string }; onClose: () => void }) {
  const [date, setDate] = useState(""); // "" = most recent
  const url = `/api/admin/chats?member=${encodeURIComponent(member.id)}${date ? `&date=${date}` : ""}`;
  const { data: chat, error, isLoading: loading } = usePageQuery<MemberChat>(["admin-chat", member.id, date], url);

  return (
    <Modal open onClose={onClose} wide title={member.name} subtitle={date ? undefined : "Most recent messages"} ariaLabel="Member chat">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-12 font-semibold text-mut">Day</span>
        <div className="w-44">
          <DateInput name="chat-date" value={date} onChange={setDate} />
        </div>
        {date && (
          <button type="button" onClick={() => setDate("")} className="text-12 font-semibold text-teal">
            Clear
          </button>
        )}
      </div>

      <div className="max-h-[55vh] min-h-40 space-y-2 overflow-y-auto rounded-xl bg-bg2 p-3">
        {loading ? (
          <p className="py-10 text-center text-12 font-medium text-mut">Loading…</p>
        ) : error ? (
          <p className="py-10 text-center text-12 font-medium text-out">{error instanceof Error ? error.message : "Could not load the chat."}</p>
        ) : !chat?.messages.length ? (
          <p className="py-10 text-center text-12 font-medium text-mut">
            No messages {date ? "on this day" : "yet"}.
          </p>
        ) : (
          chat.messages.map((m, i) => <Bubble key={i} m={m} />)
        )}
      </div>
    </Modal>
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
          <p className="whitespace-pre-wrap text-12 font-medium leading-140">{m.text}</p>
        ) : (
          <p className={`text-12 italic leading-140 ${out ? "text-white/70" : "text-mut"}`}>{m.hasMedia ? "(image)" : `(${m.kind})`}</p>
        )}
        <div className={`mt-1 text-9 font-medium leading-none ${out ? "text-white/70" : "text-fnt"}`}>{m.at}</div>
      </div>
    </div>
  );
}
