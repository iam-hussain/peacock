import "server-only";
import { prisma } from "@/server/db";
import { formatLakh } from "@/lib/money";

export interface PickOptionDTO { id: string; name: string; sub: string }
export interface EntryPickerOptions {
  members: PickOptionDTO[];
  vendors: PickOptionDTO[];
  treasurers: PickOptionDTO[];
}

/** Directory options for the Add-Entry pickers (members / vendors / treasurers). */
export async function getEntryPickerOptions(): Promise<EntryPickerOptions> {
  const members = await prisma.member.findMany({
    where: { memberships: { some: { status: "ACTIVE" } } },
    orderBy: { firstName: "asc" },
    select: {
      id: true, firstName: true, lastName: true,
      treasury: { select: { balance: true } },
      memberships: { where: { status: "ACTIVE" }, select: { accounts: { where: { kind: "MEMBER_EQUITY" }, select: { balance: true } } } },
    },
  });
  const vendors = await prisma.vendor.findMany({
    where: { status: { not: "CLOSED" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, accounts: { where: { kind: "VENDOR_RECEIVABLE" }, select: { balance: true } } },
  });

  const name = (f: string, l: string | null) => [f, l].filter(Boolean).join(" ");
  return {
    members: members.map((m) => {
      const dep = m.memberships[0]?.accounts[0]?.balance ?? 0n; // credit → negate for display
      return { id: m.id, name: name(m.firstName, m.lastName), sub: `Value ${formatLakh(-dep)}` };
    }),
    vendors: vendors.map((v) => ({ id: v.id, name: v.name, sub: `Invested ${formatLakh(v.accounts[0]?.balance ?? 0n)}` })),
    treasurers: members
      .filter((m) => m.treasury)
      .map((m) => ({ id: m.id, name: name(m.firstName, m.lastName), sub: `Holds ${formatLakh(m.treasury!.balance)}` })),
  };
}
