import "server-only";
import { prisma } from "@/server/db";
import type { WaDirection } from "@prisma/client";

/**
 * Best-effort conversation log for the admin usage dashboard. Every inbound message and every
 * outbound bot reply is stored as one lean WhatsappMessage row. Logging must NEVER break the
 * webhook or a reply, so every write is wrapped and swallowed.
 *
 * `waId` is normalised to the last 10 phone digits (same key identity.ts matches on), so an inbound
 * message and the reply to it share a thread even though Meta formats the number with a country code.
 */

const TEXT_CAP = 2000; // keep rows small — the dashboard shows previews, not essays
const last10 = (s: string) => s.replace(/\D/g, "").slice(-10);
const cap = (s?: string | null) => (s ? s.slice(0, TEXT_CAP) : null);

interface LogInput {
  waId: string;
  direction: WaDirection;
  kind: string;
  text?: string | null;
  memberId?: string | null;
  hasMedia?: boolean;
}

async function log({ waId, direction, kind, text, memberId, hasMedia }: LogInput): Promise<void> {
  try {
    await prisma.whatsappMessage.create({
      data: { waId: last10(waId), direction, kind, text: cap(text), memberId: memberId ?? null, hasMedia: hasMedia ?? false },
    });
  } catch (e) {
    console.error("WhatsApp chat log failed:", e);
  }
}

/** Record an inbound message from a member (memberId set) or an unregistered number (null). */
export const logInbound = (waId: string, kind: string, text?: string | null, memberId?: string | null, hasMedia = false) =>
  log({ waId, direction: "IN", kind, text, memberId, hasMedia });

/** Record an outbound bot reply. memberId is resolved from waId by the dashboard, so it's left null here. */
export const logOutbound = (waId: string, text?: string | null, kind = "text") => log({ waId, direction: "OUT", kind, text });
