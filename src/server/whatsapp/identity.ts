import "server-only";
import { prisma } from "@/server/db";

/**
 * WhatsApp identity = verified phone number. Meta delivers the sender's `wa_id`
 * (country code + number, e.g. "9198…"); we match its last 10 digits against
 * Member.phone. No per-member login — WhatsApp already OTP-verified the SIM.
 */

export interface WaSender {
  id: string;
  name: string;
  isAdmin: boolean;
  isTreasurer: boolean;
}

const last10 = (s: string) => s.replace(/\D/g, "").slice(-10);
export const fullName = (m: { firstName: string; lastName: string | null }) =>
  [m.firstName, m.lastName].filter(Boolean).join(" ");

const memberSelect = { id: true, firstName: true, lastName: true, phone: true, role: true, isTreasurer: true } as const;
type MemberRow = { id: string; firstName: string; lastName: string | null; phone: string; role: "ADMIN" | "MEMBER"; isTreasurer: boolean };

const toSender = (m: MemberRow): WaSender => ({ id: m.id, name: fullName(m), isAdmin: m.role === "ADMIN", isTreasurer: m.isTreasurer });

// ponytail: loads all members and matches in JS — a private club has ~20; index-backed lookup if that ever grows.
const allMembers = () => prisma.member.findMany({ where: { archivedAt: null }, select: memberSelect });

export async function senderByWaId(waId: string): Promise<WaSender | null> {
  const digits = last10(waId);
  if (digits.length < 10) return null;
  const m = (await allMembers()).find((x) => last10(x.phone) === digits);
  return m ? toSender(m) : null;
}

/** Fuzzy name → member for admin commands ("balance ravi"). Exact/prefix/substring, case-insensitive. */
export async function matchMember(q: string): Promise<{ member?: WaSender; ambiguous?: string[] }> {
  const needle = q.trim().toLowerCase();
  if (!needle) return {};
  const hits = (await allMembers()).filter((m) => fullName(m).toLowerCase().includes(needle));
  if (hits.length === 1) return { member: toSender(hits[0]) };
  if (hits.length > 1) {
    const exact = hits.find((m) => m.firstName.toLowerCase() === needle || fullName(m).toLowerCase() === needle);
    if (exact) return { member: toSender(exact) };
    return { ambiguous: hits.map(fullName) };
  }
  return {};
}
