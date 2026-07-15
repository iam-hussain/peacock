"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, MessageSquareOff, PhoneOff, Users } from "lucide-react";
import { ChatUsageList } from "./chat-usage-list";
import { ChatUnregisteredList } from "./chat-unregistered-list";
import { ChatMemberModal } from "./chat-member-modal";
import type { WhatsappStats } from "@/server/queries/whatsapp-stats";

/** Admin WhatsApp usage dashboard — who's using the bot, who's silent, and which unknown numbers
 *  are messaging the club. Click a member to read their conversation (any day). */
export function ChatStats({ data }: { data: WhatsappStats }) {
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const t = data.totals;

  return (
    <div className="mx-auto max-w-320 p-4 pb-19.5 md:p-6.5 md:pb-6.5">
      <div className="mb-5">
        <Link href="/admin" className="mb-3 inline-flex items-center gap-1.5 text-12 font-semibold text-mut hover:text-ink">
          <ArrowLeft className="size-3.5" strokeWidth={2.2} /> Admin
        </Link>
        <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">WhatsApp usage</h1>
        <p className="mt-1.75 text-13 font-medium leading-140 text-mut">
          Who is chatting with the club assistant, who hasn&apos;t yet, and any unregistered numbers messaging in.
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChatUsageList
          title="Active members"
          empty="No members have messaged the bot yet."
          rows={data.using}
          onSelect={setSelected}
        />
        <ChatUsageList
          title="Not using yet"
          empty="Everyone has messaged at least once."
          rows={data.notUsing}
          onSelect={setSelected}
          muted
        />
      </div>

      <div className="mt-4">
        <ChatUnregisteredList rows={data.unregistered} />
      </div>

      {selected && <ChatMemberModal member={selected} onClose={() => setSelected(null)} />}
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
