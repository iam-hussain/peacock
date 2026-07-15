import "server-only";
import { prisma } from "@/server/db";
import { dayMonthYear } from "@/lib/date";

/**
 * WhatsApp usage dashboard (admin-only). Answers "who's using the bot and who isn't", surfaces
 * unregistered numbers messaging the club, and drills into any member's conversation ("cibi on
 * 15th July"). Reads the WhatsappMessage log (see schema) — never the ledger.
 *
 * At club scale the message log is small, so aggregation is a single bounded fetch + a JS pass
 * rather than many groupBy round-trips. The cap is surfaced in the DTO so the UI can say so.
 */

const MSG_CAP = 8000; // bound the aggregation scan; the log is tiny for a private club
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // mirrors lib/date.ts (club runs on IST, no DST)
const last10 = (s: string) => s.replace(/\D/g, "").slice(-10);
const fullName = (f: string, l?: string | null) => [f, l].filter(Boolean).join(" ");

/** "28 Jun 2025 · 14:05" (IST) for the last-seen column. */
function whenIST(d: Date): string {
  const i = new Date(d.getTime() + IST_OFFSET_MS);
  const hh = String(i.getUTCHours()).padStart(2, "0");
  const mm = String(i.getUTCMinutes()).padStart(2, "0");
  return `${dayMonthYear(d)} · ${hh}:${mm}`;
}

export interface MemberUsage {
  id: string;
  name: string;
  phone: string;
  isActive: boolean; // holds an ACTIVE membership
  isAdmin: boolean;
  inbound: number; // messages they sent
  outbound: number; // replies the bot sent them
  lastAt: string | null; // last inbound, formatted (null = never messaged)
  lastPreview: string | null; // their most recent inbound text
}

export interface UnregisteredNumber {
  waId: string; // last-10 digits
  count: number; // inbound messages from this unknown number
  lastAt: string;
  lastPreview: string | null;
}

export interface WhatsappStats {
  totals: {
    messages: number; // exact total in the log
    inbound: number; // within the scanned window
    outbound: number;
    members: number; // registered members
    using: number; // members with ≥1 inbound
    notUsing: number; // registered members who've never messaged
    unregistered: number; // distinct unknown numbers
    capped: boolean; // aggregation hit MSG_CAP (older rows not counted here)
  };
  using: MemberUsage[]; // members who've messaged, busiest first
  notUsing: MemberUsage[]; // registered but silent
  unregistered: UnregisteredNumber[]; // unknown numbers, busiest first
}

interface Agg {
  inbound: number;
  outbound: number;
  lastInAt?: Date;
  lastInText?: string | null;
}

export async function getWhatsappStats(): Promise<WhatsappStats> {
  const [totalMessages, msgs, members] = await Promise.all([
    prisma.whatsappMessage.count(),
    prisma.whatsappMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: MSG_CAP,
      select: { waId: true, direction: true, text: true, createdAt: true },
    }),
    prisma.member.findMany({
      where: { archivedAt: null },
      select: { id: true, firstName: true, lastName: true, phone: true, role: true, memberships: { select: { status: true } } },
    }),
  ]);

  // One pass over the (desc-ordered) window: tally per waId; first sighting of an inbound row is
  // that number's most recent message (preview + timestamp).
  const byWa = new Map<string, Agg>();
  let inbound = 0;
  let outbound = 0;
  for (const m of msgs) {
    const key = last10(m.waId);
    const a = byWa.get(key) ?? { inbound: 0, outbound: 0 };
    if (m.direction === "IN") {
      a.inbound++;
      inbound++;
      if (!a.lastInAt) {
        a.lastInAt = m.createdAt;
        a.lastInText = m.text;
      }
    } else {
      a.outbound++;
      outbound++;
    }
    byWa.set(key, a);
  }

  const memberByPhone = new Map(members.map((m) => [last10(m.phone), m]));

  const usage: MemberUsage[] = members.map((m) => {
    const a = byWa.get(last10(m.phone));
    return {
      id: m.id,
      name: fullName(m.firstName, m.lastName),
      phone: m.phone,
      isActive: m.memberships.some((s) => s.status === "ACTIVE"),
      isAdmin: m.role === "ADMIN",
      inbound: a?.inbound ?? 0,
      outbound: a?.outbound ?? 0,
      lastAt: a?.lastInAt ? whenIST(a.lastInAt) : null,
      lastPreview: a?.lastInText ?? null,
    };
  });

  const using = usage.filter((u) => u.inbound > 0).sort((a, b) => b.inbound - a.inbound);
  const notUsing = usage.filter((u) => u.inbound === 0).sort((a, b) => a.name.localeCompare(b.name));

  const unregistered: UnregisteredNumber[] = [...byWa.entries()]
    .filter(([wa, a]) => a.inbound > 0 && !memberByPhone.has(wa))
    .map(([wa, a]) => ({ waId: wa, count: a.inbound, lastAt: a.lastInAt ? whenIST(a.lastInAt) : "", lastPreview: a.lastInText ?? null }))
    .sort((a, b) => b.count - a.count);

  return {
    totals: {
      messages: totalMessages,
      inbound,
      outbound,
      members: members.length,
      using: using.length,
      notUsing: notUsing.length,
      unregistered: unregistered.length,
      capped: msgs.length >= MSG_CAP,
    },
    using,
    notUsing,
    unregistered,
  };
}

export interface ChatMessage {
  direction: "IN" | "OUT";
  kind: string;
  text: string | null;
  hasMedia: boolean;
  at: string; // formatted IST
}

export interface MemberChat {
  id: string;
  name: string;
  phone: string;
  date: string | null; // the day filter echoed back (yyyy-mm-dd) or null for "recent"
  messages: ChatMessage[];
}

/** A member's conversation thread — most-recent 200, optionally narrowed to one IST day
 *  (drives "cibi on 15th July"). Matches on the member's phone, so it includes bot replies too. */
export async function getMemberChat(memberId: string, dateIso?: string): Promise<MemberChat | null> {
  const m = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true, firstName: true, lastName: true, phone: true } });
  if (!m) return null;
  const wa = last10(m.phone);

  let range: { gte: Date; lt: Date } | undefined;
  const validDay = dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? dateIso : undefined;
  if (validDay) {
    const start = new Date(new Date(`${validDay}T00:00:00.000Z`).getTime() - IST_OFFSET_MS); // IST midnight → UTC instant
    range = { gte: start, lt: new Date(start.getTime() + 86_400_000) };
  }

  const rows = await prisma.whatsappMessage.findMany({
    where: { waId: wa, ...(range ? { createdAt: range } : {}) },
    orderBy: { createdAt: validDay ? "asc" : "desc" },
    take: 200,
    select: { direction: true, kind: true, text: true, hasMedia: true, createdAt: true },
  });
  const ordered = validDay ? rows : rows.reverse(); // recent view fetched desc, shown oldest→newest

  return {
    id: m.id,
    name: fullName(m.firstName, m.lastName),
    phone: m.phone,
    date: validDay ?? null,
    messages: ordered.map((r) => ({ direction: r.direction, kind: r.kind, text: r.text, hasMedia: r.hasMedia, at: whenIST(r.createdAt) })),
  };
}
