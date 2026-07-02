import { prisma } from "@/server/db";
import type { TxnType } from "@prisma/client";
import { rupeesToPaise } from "@/lib/money";
import { ensureTreasury, ensureEquity, ensureIncome, ensureVendorAccount } from "./accounts";
import { postTransaction } from "./post-transaction";

// The add-entry "What happened?" labels → ledger TxnType (§8).
export const INTENT_TO_TYPE: Record<string, TxnType> = {
  "Member paid deposit": "PERIODIC_DEPOSIT",
  "Catch-up payment": "CATCHUP",
  "Delayed-payment penalty": "PENALTY",
  "Record repayment": "LOAN_REPAY",
  "Collect interest": "LOAN_INTEREST",
  "Vendor return": "VENDOR_RETURN",
  "Vendor write-off": "VENDOR_WRITEOFF",
  "Chit payout": "CHIT_PAYOUT",
  "Member rejoins": "REJOIN",
  "Give a loan": "LOAN_TAKEN",
  "Vendor investment": "VENDOR_INVEST",
  "Chit installment": "CHIT_PAYMENT",
  "Member leaves (settle up)": "WITHDRAW",
  "Funds transfer": "FUNDS_TRANSFER",
};

export interface EntryPayload {
  intent: string;
  party?: string; // member OR vendor name (depends on intent)
  amount?: string;
  principal?: string; // for VENDOR_RETURN / CHIT_PAYOUT / LOAN_REPAY splits
  treasurer?: string; // person holding/receiving cash
  date?: string;
  note?: string;
}

async function memberByName(name?: string) {
  if (!name) return null;
  const [first, ...rest] = name.trim().split(/\s+/);
  return prisma.member.findFirst({ where: { firstName: first, lastName: rest.length ? rest.join(" ") : undefined } });
}
async function activeMembership(memberId: string) {
  return (
    (await prisma.membership.findFirst({ where: { memberId, status: "ACTIVE" }, orderBy: { seq: "desc" } })) ??
    (await prisma.membership.findFirst({ where: { memberId }, orderBy: { seq: "desc" } }))
  );
}

/**
 * Resolve a submission payload to a balanced posting and commit it (§8). Member/
 * treasury intents are fully wired; vendor intents post when the vendor exists.
 * Loan intents are deferred (need the loan lifecycle + interest engine, §14).
 */
export async function postIntent(payload: EntryPayload, actorId?: string): Promise<{ id: string }> {
  const type = INTENT_TO_TYPE[payload.intent];
  if (!type) throw new Error(`Unknown intent: ${payload.intent}`);
  const A = rupeesToPaise(payload.amount ?? "0");
  if (A <= 0n) throw new Error("Amount must be greater than zero.");
  const occurredAt = payload.date ? new Date(payload.date) : new Date();
  const note = payload.note ?? null;

  const withMember = async () => {
    const m = await memberByName(payload.party);
    if (!m) throw new Error(`Member "${payload.party ?? ""}" not found.`);
    const ms = await activeMembership(m.id);
    if (!ms) throw new Error(`No membership for ${payload.party}.`);
    return { m, ms };
  };
  const treasuryId = async () => {
    const t = await memberByName(payload.treasurer);
    if (!t) throw new Error("Pick the treasurer handling the cash.");
    return ensureTreasury(t.id);
  };

  switch (type) {
    // TREASURY +A, MEMBER_EQUITY −A (builds member capital)
    case "PERIODIC_DEPOSIT":
    case "CATCHUP":
    case "REJOIN": {
      const { ms } = await withMember();
      const [t, e] = [await treasuryId(), await ensureEquity(ms.id)];
      const txn = await postTransaction({ type, occurredAt, description: note, membershipId: ms.id, lines: [ { accountId: t, amount: A }, { accountId: e, amount: -A } ], actorId });
      if (type === "REJOIN") await prisma.membership.update({ where: { id: ms.id }, data: { status: "ACTIVE" } });
      return txn;
    }
    // TREASURY +A, OTHER_INCOME −A (penalty pay-down = club income)
    case "PENALTY": {
      await withMember();
      const [t, o] = [await treasuryId(), await ensureIncome("OTHER_INCOME")];
      return postTransaction({ type, occurredAt, description: note, lines: [ { accountId: t, amount: A }, { accountId: o, amount: -A } ], actorId });
    }
    // TREASURY −A, MEMBER_EQUITY +A (settle & leave); membership → CLOSED
    case "WITHDRAW": {
      const { ms } = await withMember();
      const [t, e] = [await treasuryId(), await ensureEquity(ms.id)];
      const txn = await postTransaction({ type, occurredAt, description: note, membershipId: ms.id, lines: [ { accountId: t, amount: -A }, { accountId: e, amount: A } ], actorId });
      await prisma.membership.update({ where: { id: ms.id }, data: { status: "CLOSED", leftAt: occurredAt, settledAmount: A } });
      return txn;
    }
    // TREASURY(from) −A, TREASURY(to) +A
    case "FUNDS_TRANSFER": {
      const from = await memberByName(payload.treasurer);
      const to = await memberByName(payload.party);
      if (!from || !to) throw new Error("Funds transfer needs a source and destination treasurer.");
      const [ft, tt] = [await ensureTreasury(from.id), await ensureTreasury(to.id)];
      return postTransaction({ type, occurredAt, description: note, lines: [ { accountId: ft, amount: -A }, { accountId: tt, amount: A } ], actorId });
    }
    // TREASURY −A, VENDOR_RECEIVABLE +A
    case "VENDOR_INVEST":
    case "CHIT_PAYMENT": {
      const v = await prisma.vendor.findFirst({ where: { name: payload.party } });
      if (!v) throw new Error(`Vendor "${payload.party ?? ""}" not found.`);
      const [t, r] = [await treasuryId(), await ensureVendorAccount(v.id, "VENDOR_RECEIVABLE")];
      return postTransaction({ type, occurredAt, description: note, vendorId: v.id, lines: [ { accountId: t, amount: -A }, { accountId: r, amount: A } ], actorId });
    }
    // VENDOR_RECEIVABLE −A, VENDOR_PROFIT +A  (residual written off as a loss)
    case "VENDOR_WRITEOFF": {
      const v = await prisma.vendor.findFirst({ where: { name: payload.party } });
      if (!v) throw new Error(`Vendor "${payload.party ?? ""}" not found.`);
      const [r, pf] = [await ensureVendorAccount(v.id, "VENDOR_RECEIVABLE"), await ensureVendorAccount(v.id, "VENDOR_PROFIT")];
      return postTransaction({ type, occurredAt, description: note, vendorId: v.id, lines: [ { accountId: r, amount: -A }, { accountId: pf, amount: A } ], actorId });
    }
    // TREASURY +A, VENDOR_RECEIVABLE −P, VENDOR_PROFIT −(A−P)  (P defaults 0 = bank interest)
    case "VENDOR_RETURN":
    case "CHIT_PAYOUT": {
      const v = await prisma.vendor.findFirst({ where: { name: payload.party } });
      if (!v) throw new Error(`Vendor "${payload.party ?? ""}" not found.`);
      const P = payload.principal ? rupeesToPaise(payload.principal) : 0n;
      if (P > A) throw new Error("Principal returned can't exceed the amount received.");
      const [t, r, pf] = [await treasuryId(), await ensureVendorAccount(v.id, "VENDOR_RECEIVABLE"), await ensureVendorAccount(v.id, "VENDOR_PROFIT")];
      return postTransaction({ type, occurredAt, description: note, vendorId: v.id, lines: [ { accountId: t, amount: A }, { accountId: r, amount: -P }, { accountId: pf, amount: -(A - P) } ], actorId });
    }
    // Loans (§14) need the loan lifecycle + interest engine — next phase.
    case "LOAN_TAKEN":
    case "LOAN_REPAY":
    case "LOAN_INTEREST":
      throw new Error(`"${payload.intent}" needs the loan engine (next phase).`);
    default:
      throw new Error(`Intent "${payload.intent}" is not wired.`);
  }
}
