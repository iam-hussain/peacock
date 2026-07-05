import { prisma } from "@/server/db";
import type { LedgerAccountKind } from "@prisma/client";

/**
 * Chart-of-accounts resolvers (§7). Each returns the account id, creating it on
 * demand: TREASURY_CASH per person, MEMBER_EQUITY/LOAN_RECEIVABLE per stint,
 * VENDOR_* per vendor, INTEREST_INCOME/OTHER_INCOME as singletons.
 */
export async function ensureTreasury(memberId: string): Promise<string> {
  const a = await prisma.ledgerAccount.findFirst({ where: { memberId, kind: "TREASURY_CASH" } });
  if (a) return a.id;
  const c = await prisma.ledgerAccount.create({ data: { memberId, kind: "TREASURY_CASH", balance: 0n } });
  return c.id;
}

export async function ensureEquity(membershipId: string): Promise<string> {
  const a = await prisma.ledgerAccount.findFirst({ where: { membershipId, kind: "MEMBER_EQUITY" } });
  if (a) return a.id;
  const c = await prisma.ledgerAccount.create({ data: { membershipId, kind: "MEMBER_EQUITY", balance: 0n } });
  return c.id;
}

export async function ensureLoanReceivable(membershipId: string): Promise<string> {
  const a = await prisma.ledgerAccount.findFirst({ where: { membershipId, kind: "LOAN_RECEIVABLE" } });
  if (a) return a.id;
  const c = await prisma.ledgerAccount.create({ data: { membershipId, kind: "LOAN_RECEIVABLE", balance: 0n } });
  return c.id;
}

export async function ensureVendorAccount(vendorId: string, kind: "VENDOR_RECEIVABLE" | "VENDOR_PROFIT"): Promise<string> {
  const a = await prisma.ledgerAccount.findFirst({ where: { vendorId, kind } });
  if (a) return a.id;
  const c = await prisma.ledgerAccount.create({ data: { vendorId, kind, balance: 0n } });
  return c.id;
}

export async function ensureIncome(kind: "INTEREST_INCOME" | "OTHER_INCOME"): Promise<string> {
  const a = await prisma.ledgerAccount.findFirst({ where: { kind, memberId: null, membershipId: null, vendorId: null } });
  if (a) return a.id;
  const c = await prisma.ledgerAccount.create({ data: { kind: kind as LedgerAccountKind, balance: 0n } });
  return c.id;
}

/** Singleton contra-income account holding profit paid out to leavers (§12). Debit balance
 *  (positive); shareable profit subtracts it so distributed profit leaves the active pool. */
export async function ensureProfitDistributed(): Promise<string> {
  const a = await prisma.ledgerAccount.findFirst({ where: { kind: "PROFIT_DISTRIBUTED", memberId: null, membershipId: null, vendorId: null } });
  if (a) return a.id;
  const c = await prisma.ledgerAccount.create({ data: { kind: "PROFIT_DISTRIBUTED", balance: 0n } });
  return c.id;
}
