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

/** Does `name` match the typed `needle`? True when the full name, or any word in it, STARTS with
 *  the needle — so "rav"/"kumar"/"ravi k" all hit "Ravi Kumar", but a stray fragment never matches
 *  mid-word (e.g. "to" must not resolve to "Mohan Doc·to·r"). Case-insensitive. */
export function nameMatches(name: string, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return false;
  const full = name.toLowerCase();
  return full.startsWith(n) || full.split(/\s+/).some((w) => w.startsWith(n));
}

/** Fuzzy name → member for admin commands ("balance ravi"). Full-name / word-prefix, case-insensitive. */
export async function matchMember(q: string): Promise<{ member?: WaSender; ambiguous?: string[] }> {
  const needle = q.trim().toLowerCase();
  if (!needle) return {};
  const hits = (await allMembers()).filter((m) => nameMatches(fullName(m), needle));
  if (hits.length === 1) return { member: toSender(hits[0]) };
  if (hits.length > 1) {
    const exact = hits.find((m) => m.firstName.toLowerCase() === needle || fullName(m).toLowerCase() === needle);
    if (exact) return { member: toSender(exact) };
    return { ambiguous: hits.map(fullName) };
  }
  return {};
}
