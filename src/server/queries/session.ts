import "server-only";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { initials } from "@/lib/avatar";

export interface CurrentUser {
  id: string;
  name: string;
  firstName: string;
  initials: string;
  email: string;
  role: string; // "Admin" | "Treasurer" | "Member"
  isAdmin: boolean;
}

/** The signed-in member, resolved from the Better Auth session. Null if signed out. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    select: { id: true, firstName: true, lastName: true, email: true, role: true, isTreasurer: true },
  });
  if (!member) return null;
  const name = [member.firstName, member.lastName].filter(Boolean).join(" ");
  const role = member.role === "ADMIN" ? "Admin" : member.isTreasurer ? "Treasurer" : "Member";
  return {
    id: member.id,
    name,
    firstName: member.firstName,
    initials: initials(name),
    email: member.email ?? session.user.email,
    role,
    isAdmin: member.role === "ADMIN",
  };
}
