import "server-only";
import { prisma } from "@/server/db";
import { istDate } from "@/lib/date";

export type ChargeKind = "CATCHUP" | "PENALTY";

/**
 * Raise a catch-up or penalty CHARGE against a membership — the "assigned" obligation. Charges never
 * touch the ledger (paying one down is a separate cash transaction); this just creates the Charge row.
 * Reason defaults to OTHER, with the free-text note carrying context. Shared by the web admin action
 * and the WhatsApp `charge` command.
 */
export async function raiseCharge(input: {
  membershipId: string;
  kind: ChargeKind;
  amountPaise: bigint;
  reason?: string;
  note?: string | null;
  date?: string; // yyyy-mm-dd (defaults to today, IST)
}): Promise<{ id: string }> {
  const { membershipId, kind, amountPaise, reason = "OTHER", note = null, date } = input;
  if (amountPaise <= 0n) throw new Error("Enter an amount greater than zero.");
  return prisma.charge.create({
    // voidedAt explicit null: Mongo missing-key ≠ null, and live-due reads filter voidedAt: null (see db/index.ts)
    data: { membershipId, kind, reason, amount: amountPaise, occurredAt: istDate(date ? new Date(date) : new Date()), note: note || null, voidedAt: null },
    select: { id: true },
  });
}
