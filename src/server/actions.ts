"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { rupeesToPaise } from "@/lib/money";
import { approveSubmission, rejectSubmission } from "@/server/ledger/approve";

// Approve a pending money submission → posts balanced ledger entries. Reject → drops it.
export async function decideSubmission(id: string, decision: "approve" | "reject"): Promise<ActionResult> {
  try {
    if (decision === "approve") await approveSubmission(id);
    else await rejectSubmission(id);
    revalidatePath("/notifications");
    revalidatePath("/transactions");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not process the approval." };
  }
}

// Result surfaced back to the form. `deferred` = intentionally not persisted yet
// (needs Better Auth for passwords, or the double-entry ledger engine for money postings).
export type ActionResult = { ok: boolean; error?: string; deferred?: boolean };

const str = (fd: FormData, k: string) => (fd.get(k) ?? "").toString().trim();
const splitName = (full: string) => {
  const [first, ...rest] = full.trim().split(/\s+/);
  return { firstName: first, lastName: rest.length ? rest.join(" ") : null };
};

/**
 * Single entry point for every modal form. Validates by `kind`, writes via Prisma,
 * and invalidates the affected cache tags. Money-posting kinds create a pending
 * Submission (approval workflow) rather than posting to the ledger directly.
 */
export async function formAction(kind: string, fd: FormData): Promise<ActionResult> {
  try {
    switch (kind) {
      case "addMember":
        return await addMember(fd);
      case "editMember":
        return await editMember(fd);
      case "addAdmin":
        return await addAdmin(fd);
      case "newVendor":
        return await newVendor(fd);
      case "newChit":
        return await newChit(fd);
      case "editVendor":
        return await editVendor(fd);
      case "entry":
        return await submitEntry(fd);
      // Deferred until Better Auth (passwords) / the ledger engine (money math) land:
      case "changePassword":
      case "resetPassword":
      case "vendorWriteOff":
      case "closeQuarter":
        return { ok: true, deferred: true };
      default:
        return { ok: true, deferred: true };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

const memberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(3, "Phone is required"),
  email: z.string().email().or(z.literal("")).optional(),
  username: z.string().optional(),
});

async function addMember(fd: FormData): Promise<ActionResult> {
  const p = memberSchema.safeParse({
    name: str(fd, "name"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    username: str(fd, "username"),
  });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { firstName, lastName } = splitName(p.data.name);

  const existing = await prisma.member.findUnique({ where: { phone: p.data.phone } });
  if (existing) return { ok: false, error: "A member with that phone already exists." };

  await prisma.member.create({
    data: {
      firstName,
      lastName,
      phone: p.data.phone,
      email: p.data.email || null,
      username: p.data.username || null,
      customerSince: new Date(),
      memberships: {
        create: {
          seq: 1,
          status: "ACTIVE",
          joinedAt: new Date(),
          accounts: { create: { kind: "MEMBER_EQUITY", balance: 0n } },
        },
      },
    },
  });
  revalidatePath("/members");
  return { ok: true };
}

async function editMember(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  if (!id) return { ok: false, error: "Missing member id." };
  const { firstName, lastName } = splitName(str(fd, "name") || "—");
  await prisma.member.update({
    where: { id },
    data: {
      firstName,
      lastName,
      phone: str(fd, "phone") || undefined,
      email: str(fd, "email") || null,
      username: str(fd, "username") || null,
    },
  });
  revalidatePath("/members");
  revalidatePath(`/members/${id}`);
  return { ok: true };
}

async function addAdmin(fd: FormData): Promise<ActionResult> {
  const name = str(fd, "member");
  if (!name) return { ok: false, error: "Pick a member." };
  const { firstName, lastName } = splitName(name);
  const member = await prisma.member.findFirst({
    where: { firstName, lastName: lastName ?? undefined },
  });
  if (!member) return { ok: false, error: `${name} isn't in the directory yet.` };
  await prisma.member.update({ where: { id: member.id }, data: { role: "ADMIN" } });
  return { ok: true };
}

async function newVendor(fd: FormData): Promise<ActionResult> {
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Vendor name is required." };
  await prisma.vendor.create({
    data: {
      name,
      type: "GENERAL",
      category: str(fd, "category") || null,
      startedAt: new Date(),
      accounts: { create: { kind: "VENDOR_RECEIVABLE", balance: rupeesToPaise(str(fd, "invested")) } },
    },
  });
  revalidatePath("/vendors");
  return { ok: true };
}

async function newChit(fd: FormData): Promise<ActionResult> {
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Chit name is required." };
  const months = Number(str(fd, "months")) || 20;
  const value = rupeesToPaise(str(fd, "value"));
  await prisma.vendor.create({
    data: {
      name,
      type: "CHIT",
      category: "Chit",
      startedAt: new Date(),
      chit: {
        create: {
          chitValue: value,
          durationMonths: months,
          marginInstallment: rupeesToPaise(str(fd, "margin")) || (months ? value / BigInt(months) : 0n),
          startedAt: new Date(),
        },
      },
      accounts: { create: { kind: "VENDOR_RECEIVABLE", balance: 0n } },
    },
  });
  revalidatePath("/vendors");
  return { ok: true };
}

async function editVendor(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  if (!id) return { ok: true, deferred: true }; // vendor reads still on stubs; no DB id to target yet

  await prisma.vendor.update({
    where: { id },
    data: {
      name: str(fd, "name") || undefined,
      category: str(fd, "category") || null,
      status: (str(fd, "status").toUpperCase() as "ACTIVE" | "INACTIVE" | "CLOSED") || undefined,
    },
  });
  revalidatePath("/vendors");
  return { ok: true };
}

// Money entries don't post to the ledger directly — they create a PENDING submission
// that an admin approves (approval workflow). Posting happens on approval (ledger phase).
async function submitEntry(fd: FormData): Promise<ActionResult> {
  const intent = str(fd, "intent");
  if (!intent) return { ok: false, error: "Pick what happened." };
  const payload: Record<string, string> = {};
  for (const key of ["party", "amount", "date", "treasurer", "note"]) {
    const v = str(fd, key);
    if (v) payload[key] = v;
  }
  const submission = await prisma.submission.create({
    data: { intent, payload, status: "PENDING", submittedById: "rajesh-kumar" },
  });
  await prisma.notification.create({
    data: {
      recipientId: "rajesh-kumar",
      kind: "APPROVAL",
      type: "submission.pending",
      title: intent,
      body: payload.party ? `${payload.party} · ${payload.amount ?? ""}`.trim() : null,
      link: "/notifications",
      submissionId: submission.id,
    },
  });
  revalidatePath("/notifications");
  return { ok: true };
}
