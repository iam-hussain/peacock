import "server-only";
import { prisma } from "@/server/db";
import { formatLakh } from "@/lib/money";

export interface PickOptionDTO { id: string; name: string; sub: string }
export interface EntryPickerOptions {
  members: PickOptionDTO[];
  vendors: PickOptionDTO[];
  treasurers: PickOptionDTO[];
}

const fullName = (f: string, l: string | null) => [f, l].filter(Boolean).join(" ");

/**
 * Cash-holder options for every treasurer picker (add-entry holder + record-payment).
 * The club has no account of its own — ANY member can hold its cash — so this lists all
 * members, sorted: already holding money → active → inactive, then alphabetical.
 */
export async function getCashHolderOptions(): Promise<PickOptionDTO[]> {
  const members = await prisma.member.findMany({
    select: {
      id: true, firstName: true, lastName: true,
      treasury: { select: { balance: true } },
      memberships: { select: { status: true } },
    },
  });
  return members
    .map((m) => {
      const balance = m.treasury?.balance ?? 0n;
      const active = m.memberships.some((s) => s.status === "ACTIVE");
      const rank = balance > 0n ? 0 : active ? 1 : 2; // holding money → active → inactive
      return { id: m.id, name: fullName(m.firstName, m.lastName), sub: `Holds ${formatLakh(balance)}`, rank };
    })
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    .map(({ id, name, sub }) => ({ id, name, sub }));
}

/** Directory options for the Add-Entry pickers (members / vendors / treasurers). */
export async function getEntryPickerOptions(): Promise<EntryPickerOptions> {
  const [members, vendors, treasurers] = await Promise.all([
    prisma.member.findMany({
      where: { memberships: { some: { status: "ACTIVE" } } },
      orderBy: { firstName: "asc" },
      select: {
        id: true, firstName: true, lastName: true,
        memberships: { where: { status: "ACTIVE" }, select: { accounts: { where: { kind: "MEMBER_EQUITY" }, select: { balance: true } } } },
      },
    }),
    prisma.vendor.findMany({
      where: { status: { not: "CLOSED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, accounts: { where: { kind: "VENDOR_RECEIVABLE" }, select: { balance: true } } },
    }),
    getCashHolderOptions(),
  ]);

  return {
    members: members.map((m) => {
      const dep = m.memberships[0]?.accounts[0]?.balance ?? 0n; // credit → negate for display
      return { id: m.id, name: fullName(m.firstName, m.lastName), sub: `Value ${formatLakh(-dep)}` };
    }),
    vendors: vendors.map((v) => ({ id: v.id, name: v.name, sub: `Invested ${formatLakh(v.accounts[0]?.balance ?? 0n)}` })),
    treasurers,
  };
}
