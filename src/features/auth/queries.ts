import "server-only";
import { prisma } from "@/server/db";

export type ProfileStatus = "active" | "inactive" | "left";

export interface LoginProfile {
  id: string;
  name: string;
  email: string;
  tag: string; // role label only, e.g. "Treasurer" / "Admin" / "Member"
  status: ProfileStatus;
}

function tagFor(role: string, isTreasurer: boolean): string {
  if (role === "ADMIN") return isTreasurer ? "Treasurer · Admin" : "Admin";
  return isTreasurer ? "Treasurer" : "Member";
}

/** The sign-in directory: every member with a linked auth user, newest joiners last. */
export async function getLoginProfiles(): Promise<LoginProfile[]> {
  const members = await prisma.member.findMany({
    where: { user: { isNot: null } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      isTreasurer: true,
      archivedAt: true,
      customerSince: true,
      user: { select: { email: true } },
      memberships: { select: { status: true } },
    },
    orderBy: { customerSince: "asc" },
  });

  return members.map((m) => {
    const active = m.memberships.some((s) => s.status === "ACTIVE");
    const status: ProfileStatus = active ? "active" : m.archivedAt ? "left" : "inactive";
    return {
      id: m.id,
      name: [m.firstName, m.lastName].filter(Boolean).join(" "),
      email: m.user!.email,
      tag: tagFor(m.role, m.isTreasurer),
      status,
    };
  });
}
