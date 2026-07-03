"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { rupeesToPaise } from "@/lib/money";
import { headers } from "next/headers";
import { approveSubmission, rejectSubmission } from "@/server/ledger/approve";
import { postIntent } from "@/server/ledger/intents";
import { reverseTransaction, editTransactionAmount } from "@/server/ledger/reverse";
import { auth } from "@/server/auth";
import { getCurrentUser } from "@/server/queries/session";
import { quarterBounds } from "@/lib/quarter";
import { quarterFigures } from "@/server/queries/close-quarter";

// One admin gate for every mutation. Reads = free; writes below the line are admin-only.
async function requireAdmin(): Promise<string | null> {
  const me = await getCurrentUser();
  return me?.isAdmin ? null : "Only an admin can do that.";
}

// Approve a pending money submission → posts balanced ledger entries. Reject → drops it.
export async function decideSubmission(id: string, decision: "approve" | "reject"): Promise<ActionResult> {
  try {
    const me = await getCurrentUser();
    if (!me?.isAdmin) return { ok: false, error: "Only an admin can do that." };
    if (decision === "approve") await approveSubmission(id, me.id);
    else await rejectSubmission(id, me.id);
    revalidatePath("/notifications");
    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not process the approval." };
  }
}

// Clear the bell: mark every unread notification read.
export async function markAllRead(): Promise<ActionResult> {
  try {
    await prisma.notification.updateMany({ where: { isRead: false }, data: { isRead: true } });
    revalidatePath("/notifications");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not mark all read." };
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
// Self-service kinds any signed-in member may run; everything else is admin-gated (fail-closed).
const SELF_SERVICE = new Set(["changePassword", "editProfile", "entry"]);

export async function formAction(kind: string, fd: FormData): Promise<ActionResult> {
  try {
    if (!SELF_SERVICE.has(kind)) {
      const denied = await requireAdmin();
      if (denied) return { ok: false, error: denied };
    }
    switch (kind) {
      case "addMember":
        return await addMember(fd);
      case "editMember":
        return await editMember(fd);
      case "newVendor":
        return await newVendor(fd);
      case "newChit":
        return await newChit(fd);
      case "editVendor":
        return await editVendor(fd);
      case "addCharge":
        return await addCharge(fd);
      case "editCharge":
        return await editCharge(fd);
      case "rejoin":
        return await rejoin(fd);
      case "settle":
        return await settle(fd);
      case "vendorWriteOff":
        return await vendorWriteOff(fd);
      case "recordPayment":
        return await recordPayment(fd);
      case "editPayment":
        return await editPayment(fd);
      case "deleteCharge":
        return await deleteCharge(fd);
      case "deletePayment":
        return await deletePayment(fd);
      case "editTransaction":
        return await editTransaction(fd);
      case "deleteTransaction":
        return await deleteTransaction(fd);
      case "entry":
        return await submitEntry(fd);
      case "changePassword":
        return await changePassword(fd);
      case "resetPassword":
        return await resetPassword(fd);
      case "editProfile":
        return await editProfile(fd);
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
  if (!id) return { ok: false, error: "Missing vendor." };

  await prisma.vendor.update({
    where: { id },
    data: {
      name: str(fd, "name") || undefined,
      category: str(fd, "category") || null,
      status: (str(fd, "status").toUpperCase() as "ACTIVE" | "INACTIVE" | "CLOSED") || undefined,
    },
  });
  // Chit vendors also carry value / duration / margin — update the ChitFund when those come through.
  const value = str(fd, "value");
  const months = str(fd, "months");
  const margin = str(fd, "margin");
  if (value || months || margin) {
    await prisma.chitFund.updateMany({
      where: { vendorId: id },
      data: {
        ...(value ? { chitValue: rupeesToPaise(value) } : {}),
        ...(months ? { durationMonths: Number(months) } : {}),
        ...(margin ? { marginInstallment: rupeesToPaise(margin) } : {}),
      },
    });
  }
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
  return { ok: true };
}

const CATCHUP_REASONS = new Set(["FIRST_TIME_JOIN", "REJOIN", "PROFIT_GAP_TOPUP", "MID_TERM_EQUALISATION", "OTHER"]);
const PENALTY_REASONS = new Set(["DELAYED_PAYMENT", "LOAN_REPAYMENT_DELAY", "HOLDING_TOO_LONG", "MISSED_DEPOSIT", "OTHER"]);

const chargeSchema = z.object({
  membershipId: z.string().min(1, "Missing membership."),
  memberId: z.string().min(1, "Missing member."),
  type: z.string().min(1),
  amount: z.string().min(1, "Amount is required"),
  reason: z.string().optional(),
  date: z.string().optional(),
  note: z.string().optional(),
});

// Admin raises a catch-up or penalty CHARGE against a membership (the "assigned" obligation).
// Paying it down is a separate cash transaction; here we just create the Charge row.
async function addCharge(fd: FormData): Promise<ActionResult> {
  const p = chargeSchema.safeParse({
    membershipId: str(fd, "membershipId"),
    memberId: str(fd, "memberId"),
    type: str(fd, "type"),
    amount: str(fd, "amount"),
    reason: str(fd, "reason"),
    date: str(fd, "date"),
    note: str(fd, "note"),
  });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const amount = rupeesToPaise(p.data.amount);
  if (amount <= 0n) return { ok: false, error: "Enter an amount greater than zero." };
  const kind = p.data.type.toLowerCase().startsWith("pen") ? "PENALTY" : "CATCHUP";
  const valid = kind === "PENALTY" ? PENALTY_REASONS : CATCHUP_REASONS;
  const reason = p.data.reason && valid.has(p.data.reason) ? p.data.reason : "OTHER";
  await prisma.charge.create({
    data: { membershipId: p.data.membershipId, kind, reason, amount, occurredAt: p.data.date ? new Date(p.data.date) : new Date(), note: p.data.note || null },
  });
  revalidatePath(`/members/${p.data.memberId}`);
  return { ok: true };
}

// Edit an existing charge's amount / reason / date / note (admin correction).
async function editCharge(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  const memberId = str(fd, "memberId");
  if (!id || !memberId) return { ok: false, error: "Missing charge." };
  const amount = rupeesToPaise(str(fd, "amount"));
  if (amount <= 0n) return { ok: false, error: "Enter an amount greater than zero." };
  const reason = str(fd, "reason");
  const date = str(fd, "date");
  await prisma.charge.update({
    where: { id },
    data: {
      amount,
      note: str(fd, "note") || null,
      ...(reason && (CATCHUP_REASONS.has(reason) || PENALTY_REASONS.has(reason)) ? { reason } : {}),
      ...(date ? { occurredAt: new Date(date) } : {}),
    },
  });
  revalidatePath(`/members/${memberId}`);
  return { ok: true };
}

// Delete a charge (obligation row) — charges never touch the ledger, so just remove the row.
async function deleteCharge(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  const memberId = str(fd, "memberId");
  if (!id || !memberId) return { ok: false, error: "Missing charge." };
  await prisma.charge.delete({ where: { id } });
  revalidatePath(`/members/${memberId}`);
  return { ok: true };
}

// Delete a recorded pay-down — reverse its ledger legs (undo the balance changes), then remove it.
async function deletePayment(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  const memberId = str(fd, "memberId");
  if (!id || !memberId) return { ok: false, error: "Missing payment." };
  const txn = await prisma.transaction.findUnique({ where: { id }, select: { entries: { select: { id: true, accountId: true, amount: true } } } });
  if (!txn) return { ok: false, error: "Payment not found." };
  await prisma.$transaction(async (tx) => {
    for (const e of txn.entries) {
      await tx.ledgerAccount.update({ where: { id: e.accountId }, data: { balance: { increment: -e.amount } } });
    }
    await tx.entry.deleteMany({ where: { transactionId: id } });
    await tx.transaction.delete({ where: { id } });
  });
  revalidatePath(`/members/${memberId}`);
  return { ok: true };
}

// A ledger correction touches balances that feed every money view — revalidate them all.
function revalidateLedger() {
  for (const p of ["/transactions", "/dashboard", "/members", "/vendors", "/analytics", "/notifications"]) revalidatePath(p);
}

// Delete a posted transaction (§16): post a reversal (keeps history), row drops out of the feed.
async function deleteTransaction(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  if (!id) return { ok: false, error: "Missing transaction." };
  try {
    await reverseTransaction(id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not delete the transaction." };
  }
  revalidateLedger();
  return { ok: true };
}

// Edit a posted transaction's amount / date (§16): reverse the original, re-post the corrected one.
async function editTransaction(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  if (!id) return { ok: false, error: "Missing transaction." };
  const amount = rupeesToPaise(str(fd, "amount"));
  if (amount <= 0n) return { ok: false, error: "Enter an amount greater than zero." };
  try {
    await editTransactionAmount(id, amount, str(fd, "date") || undefined);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not edit the transaction." };
  }
  revalidateLedger();
  return { ok: true };
}

// Rejoin (PRODUCT.md §12): open a fresh membership #N+1 (Active) for a person whose last
// membership is closed, and raise the auto-suggested catch-up as a "Rejoin" charge they pay
// down over time. Back deposits aren't a charge — they surface as the new membership's normal
// pending dues (0 paid vs the full club-life baseline). No cash moves here.
async function rejoin(fd: FormData): Promise<ActionResult> {
  const memberId = str(fd, "memberId");
  if (!memberId) return { ok: false, error: "Missing member." };
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, memberships: { select: { seq: true, status: true } } },
  });
  if (!member) return { ok: false, error: "Member not found." };
  if (member.memberships.some((s) => s.status === "ACTIVE")) return { ok: false, error: "This member is already active." };

  const catchup = rupeesToPaise(str(fd, "catchup"));
  if (catchup < 0n) return { ok: false, error: "Catch-up can't be negative." };
  const date = str(fd, "date") ? new Date(str(fd, "date")) : new Date();
  const nextSeq = Math.max(0, ...member.memberships.map((s) => s.seq)) + 1;

  await prisma.$transaction(async (tx) => {
    const ms = await tx.membership.create({
      data: {
        memberId,
        seq: nextSeq,
        status: "ACTIVE",
        joinedAt: date,
        accounts: { create: { kind: "MEMBER_EQUITY", balance: 0n } },
      },
    });
    if (catchup > 0n) {
      await tx.charge.create({
        data: { membershipId: ms.id, kind: "CATCHUP", reason: "REJOIN", amount: catchup, occurredAt: date, note: str(fd, "note") || null },
      });
    }
    // Clear the archived flag so a member who had fully "left" reads as active again.
    await tx.member.update({ where: { id: memberId }, data: { archivedAt: null } });
  });
  revalidatePath("/members");
  revalidatePath(`/members/${memberId}`);
  return { ok: true };
}

// Close the current quarter (§18): freeze a snapshot + lock its entries (enforced in
// postTransaction). Profit keeps accumulating; this is snapshot + lock, no distribution.
export async function closeQuarterNow(): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me?.isAdmin) return { ok: false, error: "Only an admin can close a quarter." };
  const cfg = await prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { fyStartMonth: true } });
  const { start, end, label } = quarterBounds(new Date(), cfg?.fyStartMonth ?? 4);
  if (await prisma.periodClose.findUnique({ where: { periodStart: start } })) return { ok: false, error: `${label} is already closed.` };
  const f = await quarterFigures(start, end);
  await prisma.periodClose.create({
    data: {
      periodStart: start,
      periodEnd: end,
      closedById: me.id,
      snapshot: {
        label,
        profitPaise: f.netProfitPaise.toString(),
        availableCashPaise: f.availableCashPaise.toString(),
        portfolioPaise: f.portfolioPaise.toString(),
        activeMembers: f.activeMembers,
      },
    },
  });
  revalidatePath("/settings");
  return { ok: true };
}

// The signed-in user changes their own password (Better Auth validates the current one).
async function changePassword(fd: FormData): Promise<ActionResult> {
  const currentPassword = str(fd, "current");
  const newPassword = str(fd, "new");
  if (newPassword.length < 6) return { ok: false, error: "New password must be at least 6 characters." };
  if (newPassword !== str(fd, "confirm")) return { ok: false, error: "New passwords don't match." };
  try {
    await auth.api.changePassword({ body: { currentPassword, newPassword }, headers: await headers() });
    const me = await getCurrentUser();
    if (me) await prisma.member.update({ where: { id: me.id }, data: { mustChangePassword: false } });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not change password — check your current one." };
  }
  return { ok: true };
}

// Admin resets a member's password to their phone number (default) or a custom value, and flags
// mustChangePassword so the member is forced to set their own on next login.
async function resetPassword(fd: FormData): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me?.isAdmin) return { ok: false, error: "Only an admin can reset passwords." };
  const memberName = str(fd, "member");
  if (!memberName) return { ok: false, error: "Pick a member." };
  const { firstName, lastName } = splitName(memberName);
  const member = await prisma.member.findFirst({ where: { firstName, lastName: lastName ?? undefined }, select: { id: true, phone: true, userId: true } });
  if (!member?.userId) return { ok: false, error: `${memberName} has no login account.` };
  const newPassword = str(fd, "custom") || member.phone || "";
  if (newPassword.length < 6) return { ok: false, error: "No default password available — enter a custom one (min 6 chars)." };
  try {
    const ctx = await auth.$context;
    const hash = await ctx.password.hash(newPassword);
    await ctx.internalAdapter.updatePassword(member.userId, hash);
    await prisma.member.update({ where: { id: member.id }, data: { mustChangePassword: true } });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not reset the password." };
  }
  return { ok: true };
}

// The signed-in member edits their own profile (name, phone, email, username, avatar URL).
async function editProfile(fd: FormData): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in." };
  const p = memberSchema.safeParse({ name: str(fd, "name"), phone: str(fd, "phone"), email: str(fd, "email"), username: str(fd, "username") });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { firstName, lastName } = splitName(p.data.name);
  const clash = await prisma.member.findFirst({ where: { phone: p.data.phone, id: { not: me.id } }, select: { id: true } });
  if (clash) return { ok: false, error: "Another member already uses that phone." };
  await prisma.member.update({
    where: { id: me.id },
    data: {
      firstName,
      lastName,
      phone: p.data.phone,
      email: p.data.email || null,
      username: p.data.username || null,
    },
  });
  revalidatePath("/settings");
  revalidatePath(`/members/${me.id}`);
  return { ok: true };
}

// The signed-in member sets their own avatar (cropped + resized to a small square on the client,
// passed here as a base64 data URL and stored inline on the member row).
export async function updateAvatar(dataUrl: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in." };
  const cleared = dataUrl === "";
  if (!cleared) {
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl)) return { ok: false, error: "Unsupported image." };
    if (dataUrl.length > 400_000) return { ok: false, error: "Image is too large — crop smaller." }; // ~300KB decoded
  }
  await prisma.member.update({ where: { id: me.id }, data: { avatarUrl: cleared ? null : dataUrl } });
  revalidatePath("/settings");
  revalidatePath(`/members/${me.id}`);
  return { ok: true };
}

// Admin grants/revokes the ADMIN role on a member (used by the Admins management sheet).
export async function setAdmin(memberId: string, makeAdmin: boolean): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me?.isAdmin) return { ok: false, error: "Only an admin can change admins." };
  if (!makeAdmin) {
    if (memberId === me.id) return { ok: false, error: "You can't remove your own admin access." };
    const admins = await prisma.member.count({ where: { role: "ADMIN" } });
    if (admins <= 1) return { ok: false, error: "The club needs at least one admin." };
  }
  await prisma.member.update({ where: { id: memberId }, data: { role: makeAdmin ? "ADMIN" : "MEMBER" } });
  revalidatePath("/settings");
  return { ok: true };
}

// Admin edits club settings (design "Edit club settings"): name & timezone are locked; the
// dividend toggle flips instantly; a new monthly-deposit amount or loan rate is an APPEND to the
// dated history (effective going forward — past records untouched). Both fields of a pair required.
type ClubStage = { name?: string; amountPaise: number; startDate: string; endDate?: string | null };
type ClubRate = { rateBps: number; effectiveFrom: string };

export async function saveClubSettings(input: {
  dividend: boolean;
  depositAmount?: string; depositFrom?: string; // ₹ + yyyy-mm-dd
  rate?: string; rateFrom?: string; // %/mo + yyyy-mm-dd
}): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me?.isAdmin) return { ok: false, error: "Only an admin can edit the club." };
  const cfg = await prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { stages: true, rateSchedule: true } });
  if (!cfg) return { ok: false, error: "Club config not found." };

  const data: { dividendEnabled: boolean; stages?: ClubStage[]; rateSchedule?: ClubRate[] } = { dividendEnabled: input.dividend };

  const depA = (input.depositAmount ?? "").trim();
  const depD = (input.depositFrom ?? "").trim();
  if (depA || depD) {
    if (!depA || !depD) return { ok: false, error: "Enter both a new deposit amount and its effective date." };
    const amount = Number(rupeesToPaise(depA));
    if (amount <= 0) return { ok: false, error: "Deposit amount must be greater than zero." };
    const from = new Date(depD);
    if (Number.isNaN(from.getTime())) return { ok: false, error: "Enter a valid deposit effective date." };
    const stages = ([...(cfg.stages as unknown as ClubStage[])]).sort((a, b) => a.startDate.localeCompare(b.startDate));
    const last = stages[stages.length - 1];
    if (last && depD <= last.startDate) return { ok: false, error: "Effective date must be after the current stage." };
    if (last) last.endDate = depD;
    stages.push({ name: `Stage ${stages.length + 1}`, amountPaise: amount, startDate: depD });
    data.stages = stages;
  }

  const rA = (input.rate ?? "").trim();
  const rD = (input.rateFrom ?? "").trim();
  if (rA || rD) {
    if (!rA || !rD) return { ok: false, error: "Enter both a new rate and its effective date." };
    const rateBps = Math.round(Number(rA) * 100);
    if (!Number.isFinite(rateBps) || rateBps < 0) return { ok: false, error: "Enter a valid interest rate." };
    if (Number.isNaN(new Date(rD).getTime())) return { ok: false, error: "Enter a valid rate effective date." };
    const sched = ([...(cfg.rateSchedule as unknown as ClubRate[])]).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    const last = sched[sched.length - 1];
    if (last && rD <= last.effectiveFrom) return { ok: false, error: "Rate effective date must be after the current one." };
    sched.push({ rateBps, effectiveFrom: rD });
    data.rateSchedule = sched;
  }

  await prisma.clubConfig.update({ where: { id: "singleton" }, data });
  for (const p of ["/settings", "/members", "/loans", "/dashboard", "/analytics"]) revalidatePath(p);
  return { ok: true };
}

// Write off a vendor loss (§ vendor mgmt): reduces the receivable and books the shortfall against
// vendor profit. No cash moves — it's an accounting loss. Resolves the vendor by name.
async function vendorWriteOff(fd: FormData): Promise<ActionResult> {
  const party = str(fd, "party");
  if (!party) return { ok: false, error: "Missing vendor." };
  try {
    await postIntent({
      intent: "Vendor write-off",
      party,
      amount: str(fd, "amount"),
      date: str(fd, "date"),
      note: str(fd, "reason") || undefined,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not write off the vendor." };
  }
  const vendorId = str(fd, "vendorId");
  revalidatePath("/vendors");
  if (vendorId) revalidatePath(`/vendors/${vendorId}`);
  return { ok: true };
}

// Settle up & leave (PRODUCT.md §12): admin pays the member out in cash from a treasurer and
// closes their membership. Posts the WITHDRAW intent (TREASURY −A, MEMBER_EQUITY +A; membership
// → CLOSED with leave date + settled amount). Profit zeroes out once they're no longer active.
async function settle(fd: FormData): Promise<ActionResult> {
  const memberId = str(fd, "memberId");
  try {
    await postIntent({
      intent: "Member leaves (settle up)",
      party: str(fd, "party"),
      amount: str(fd, "amount"),
      treasurer: str(fd, "treasurer"),
      date: str(fd, "date"),
      note: str(fd, "note"),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not settle the member." };
  }
  revalidatePath("/members");
  revalidatePath(`/members/${memberId}`);
  return { ok: true };
}

// Record a catch-up / penalty pay-down → posts a balanced ledger transaction directly (§8).
async function recordPayment(fd: FormData): Promise<ActionResult> {
  const memberId = str(fd, "memberId");
  const isPenalty = str(fd, "type").toLowerCase().startsWith("pen");
  try {
    await postIntent({
      intent: isPenalty ? "Delayed-payment penalty" : "Catch-up payment",
      party: str(fd, "party"),
      amount: str(fd, "amount"),
      treasurer: str(fd, "treasurer"),
      date: str(fd, "date"),
      note: str(fd, "note"),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not record the payment." };
  }
  revalidatePath(`/members/${memberId}`);
  return { ok: true };
}

// Edit a recorded payment's amount / date by re-scaling its (balanced) 2-leg posting.
async function editPayment(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  const memberId = str(fd, "memberId");
  if (!id || !memberId) return { ok: false, error: "Missing payment." };
  const amount = rupeesToPaise(str(fd, "amount"));
  if (amount <= 0n) return { ok: false, error: "Enter an amount greater than zero." };
  const date = str(fd, "date");
  const txn = await prisma.transaction.findUnique({ where: { id }, select: { entries: { select: { id: true, accountId: true, amount: true } } } });
  if (!txn) return { ok: false, error: "Payment not found." };
  // ponytail: assumes a balanced 2-leg pay-down; re-scale each leg to the new magnitude.
  await prisma.$transaction(async (tx) => {
    for (const e of txn.entries) {
      const next = e.amount > 0n ? amount : -amount;
      const delta = next - e.amount;
      if (delta === 0n) continue;
      await tx.entry.update({ where: { id: e.id }, data: { amount: next } });
      await tx.ledgerAccount.update({ where: { id: e.accountId }, data: { balance: { increment: delta } } });
    }
    if (date) await tx.transaction.update({ where: { id }, data: { occurredAt: new Date(date) } });
  });
  revalidatePath(`/members/${memberId}`);
  return { ok: true };
}

// Money entries don't post to the ledger directly — they create a PENDING submission
// that an admin approves (approval workflow). Posting happens on approval (ledger phase).
async function submitEntry(fd: FormData): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in." };
  const intent = str(fd, "intent");
  if (!intent) return { ok: false, error: "Pick what happened." };
  const payload: Record<string, string> = {};
  for (const key of ["party", "amount", "date", "treasurer", "note"]) {
    const v = str(fd, key);
    if (v) payload[key] = v;
  }
  const submission = await prisma.submission.create({
    data: { intent, payload, status: "PENDING", submittedById: me.id },
  });
  // Approval goes to every admin's inbox.
  const admins = await prisma.member.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  const body = payload.party ? `${payload.party} · ${payload.amount ?? ""}`.trim() : null;
  await prisma.notification.createMany({
    data: admins.map((a) => ({
      recipientId: a.id,
      kind: "APPROVAL" as const,
      type: "submission.pending",
      title: intent,
      body,
      link: "/notifications",
      submissionId: submission.id,
    })),
  });
  revalidatePath("/notifications");
  return { ok: true };
}
