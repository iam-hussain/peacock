"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { rupeesToPaise } from "@/lib/money";
import { headers } from "next/headers";
import { approveSubmission, rejectSubmission } from "@/server/ledger/approve";
import { postIntent } from "@/server/ledger/intents";
import { settleMembership } from "@/server/ledger/settle";
import { reverseTransaction, editTransactionAmount } from "@/server/ledger/reverse";
import { auth } from "@/server/auth";
import { getCurrentUser } from "@/server/queries/session";
import { shareableClubProfit } from "@/server/queries/members";
import { getPenaltyConfig, serializePenaltyConfig, type PenaltyConfig } from "@/server/queries/penalties";
import { syncAutoPenalties, syncAutoPenaltiesSafe } from "@/server/ledger/auto-penalties";
import { getActivity } from "@/server/queries/notifications";
import { quarterBounds } from "@/lib/quarter";
import { istDate } from "@/lib/date";
import { quarterFigures } from "@/server/queries/close-quarter";
import { bustStats } from "@/server/stats";

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
    // An approval posts to the ledger, touching every money view — invalidate them all, not just three.
    if (decision === "approve") await syncAutoPenaltiesSafe(); // a posted deposit / interest payment can settle or trigger an auto penalty
    revalidateLedger();
    await bustStats();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not process the approval." };
  }
}

// One more page of activity for the notifications feed ("Load more").
export async function loadActivity(offset: number) {
  return getActivity(offset);
}

// Clear the bell: mark every unread notification read.
export async function markAllRead(): Promise<ActionResult> {
  try {
    const me = await getCurrentUser();
    if (!me) return { ok: false, error: "Not signed in." };
    await prisma.notification.updateMany({ where: { recipientId: me.id, isRead: false }, data: { isRead: true } });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not mark all read." };
  }
}

// Result surfaced back to the form. `deferred` = intentionally not persisted yet
// (needs Better Auth for passwords, or the double-entry ledger engine for money postings).
export type ActionResult = { ok: boolean; error?: string; deferred?: boolean };

const str = (fd: FormData, k: string) => (fd.get(k) ?? "").toString().trim();
// Parse a form date/month string ("2026-06-01" or "2026-06") to a Date; empty/invalid → today.
// Normalized to the IST calendar date at UTC midnight — all stored dates are date-only.
const parseFormDate = (s: string): Date => {
  const d = s ? new Date(s) : new Date();
  return istDate(Number.isNaN(d.getTime()) ? new Date() : d);
};
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
// Money entries (entry, recordPayment) are self-service too, but `postOrSubmit` still splits admin
// (posts directly) from member (pending submission) per PRODUCT.md §15.
const SELF_SERVICE = new Set(["changePassword", "editProfile", "entry", "recordPayment"]);

export async function formAction(kind: string, fd: FormData): Promise<ActionResult> {
  try {
    if (!SELF_SERVICE.has(kind)) {
      const denied = await requireAdmin();
      if (denied) return { ok: false, error: denied };
    }
    const res = await dispatch(kind, fd);
    if (res.ok) {
      // "Add entry will calculate if new found" (§13.2): recording an entry materialises any auto
      // penalty that has newly come due (deduped by its deterministic id). Best-effort — a sync
      // hiccup never fails the entry the user just recorded.
      await syncAutoPenaltiesSafe();
      await bustStats(); // every form mutates something a snapshot shows
    }
    return res;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

async function dispatch(kind: string, fd: FormData): Promise<ActionResult> {
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
}

const memberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(3, "Phone is required"),
  email: z.string().email().or(z.literal("")).optional(),
  username: z.string().optional(),
});

// First/last name captured separately; phone required (default password); joined date drives
// customerSince + the first-join catch-up date; status toggle sets the opening membership state.
const addMemberSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  phone: z.string().min(3, "Phone is required"),
  email: z.string().email().or(z.literal("")).optional(),
  username: z.string().optional(),
});

async function addMember(fd: FormData): Promise<ActionResult> {
  const p = addMemberSchema.safeParse({
    firstName: str(fd, "firstName"),
    lastName: str(fd, "lastName"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    username: str(fd, "username"),
  });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };

  const avatar = str(fd, "avatar");
  if (avatar && !/^data:image\/(png|jpeg|webp);base64,/.test(avatar)) return { ok: false, error: "Unsupported image." };
  if (avatar.length > 400_000) return { ok: false, error: "Photo is too large — crop smaller." };
  const active = str(fd, "status") !== "Inactive"; // toggle: on = Active (default)
  const joinedAt = parseFormDate(str(fd, "joined"));

  const existing = await prisma.member.findUnique({ where: { phone: p.data.phone } });
  if (existing) return { ok: false, error: "A member with that phone already exists." };

  // Catch-up auto-added at first join (§7): equalise the newcomer to the club's average
  // per-member profit (their own profit is 0). Uses shareableClubProfit — the same base as the
  // dashboard's "profit per member" and the rejoin catch-up (members.ts) — so all three agree.
  const [pooledProfit, activeCount] = await Promise.all([
    shareableClubProfit(),
    prisma.membership.count({ where: { status: "ACTIVE" } }),
  ]);
  const catchup = activeCount > 0 && pooledProfit > 0n ? pooledProfit / BigInt(activeCount) : 0n;

  await prisma.$transaction(async (tx) => {
    const ms = await tx.membership.create({
      data: {
        seq: 1,
        // "Inactive" members are a CLOSED opening membership with no archive date (memberStatus →
        // "inactive"); the admin later reactivates them via Rejoin. Active is the normal path.
        status: active ? "ACTIVE" : "CLOSED",
        joinedAt,
        member: {
          create: {
            firstName: p.data.firstName,
            lastName: p.data.lastName || null,
            phone: p.data.phone,
            email: p.data.email || null,
            username: p.data.username || null,
            avatarUrl: avatar || null,
            customerSince: joinedAt,
          },
        },
        accounts: { create: { kind: "MEMBER_EQUITY", balance: 0n } },
      },
    });
    if (catchup > 0n) {
      await tx.charge.create({
        data: { membershipId: ms.id, kind: "CATCHUP", reason: "FIRST_TIME_JOIN", amount: catchup, occurredAt: joinedAt, note: null },
      });
    }
  });
  revalidatePath("/members");
  revalidatePath("/dashboard");
  return { ok: true };
}

async function editMember(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  if (!id) return { ok: false, error: "Missing member id." };
  const p = memberSchema.safeParse({ name: str(fd, "name"), phone: str(fd, "phone"), email: str(fd, "email"), username: str(fd, "username") });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { firstName, lastName } = splitName(p.data.name);
  const clash = await prisma.member.findFirst({ where: { phone: p.data.phone, id: { not: id } }, select: { id: true } });
  if (clash) return { ok: false, error: "Another member already uses that phone." };
  await prisma.member.update({
    where: { id },
    data: {
      firstName,
      lastName,
      phone: p.data.phone,
      email: p.data.email || null,
      username: p.data.username || null,
    },
  });
  revalidatePath("/members");
  revalidatePath(`/members/${id}`);
  return { ok: true };
}

// Optional yyyy-mm-dd string that, when present, must parse to a real date. Shared by the money
// actions so a garbage date is rejected at the boundary instead of silently becoming `Invalid Date`.
const optDate = z.string().optional().refine((s) => !s || !Number.isNaN(new Date(s).getTime()), "Enter a valid date.");

const newVendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required."),
  category: z.string().optional(),
  cycle: optDate,
});

async function newVendor(fd: FormData): Promise<ActionResult> {
  const p = newVendorSchema.safeParse({ name: str(fd, "name"), category: str(fd, "category"), cycle: str(fd, "cycle") });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  // Capital & returns come from ledger entries later, so the vendor opens with a zero receivable.
  await prisma.vendor.create({
    data: {
      name: p.data.name,
      type: "GENERAL",
      category: p.data.category || null,
      startedAt: parseFormDate(p.data.cycle ?? ""),
      accounts: { create: { kind: "VENDOR_RECEIVABLE", balance: 0n } },
    },
  });
  revalidatePath("/vendors");
  return { ok: true };
}

const newChitSchema = z.object({
  name: z.string().min(1, "Chit name is required."),
  months: z.string().optional(),
  value: z.string().optional(),
  margin: z.string().optional(),
  start: optDate,
});

async function newChit(fd: FormData): Promise<ActionResult> {
  const p = newChitSchema.safeParse({ name: str(fd, "name"), months: str(fd, "months"), value: str(fd, "value"), margin: str(fd, "margin"), start: str(fd, "start") });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const months = Number(p.data.months) || 20;
  const value = rupeesToPaise(p.data.value ?? "");
  const startedAt = parseFormDate(p.data.start ?? "");
  await prisma.vendor.create({
    data: {
      name: p.data.name,
      type: "CHIT",
      category: "Chit",
      startedAt,
      chit: {
        create: {
          chitValue: value,
          durationMonths: months,
          marginInstallment: rupeesToPaise(p.data.margin ?? "") || (months ? value / BigInt(months) : 0n),
          startedAt,
        },
      },
      accounts: { create: { kind: "VENDOR_RECEIVABLE", balance: 0n } },
    },
  });
  revalidatePath("/vendors");
  return { ok: true };
}

const editVendorSchema = z.object({
  id: z.string().min(1, "Missing vendor."),
  name: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  value: z.string().optional(),
  months: z.string().optional(),
  margin: z.string().optional(),
  start: z.string().optional(),
});

async function editVendor(fd: FormData): Promise<ActionResult> {
  const p = editVendorSchema.safeParse({ id: str(fd, "id"), name: str(fd, "name"), category: str(fd, "category"), status: str(fd, "status"), value: str(fd, "value"), months: str(fd, "months"), margin: str(fd, "margin"), start: str(fd, "start") });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { id } = p.data;

  await prisma.vendor.update({
    where: { id },
    data: {
      name: p.data.name || undefined,
      category: p.data.category || null,
      status: (p.data.status ? (p.data.status.toUpperCase() as "ACTIVE" | "INACTIVE" | "CLOSED") : undefined),
      ...(p.data.start ? { startedAt: parseFormDate(p.data.start) } : {}),
    },
  });
  // Chit vendors also carry value / duration / margin / start — update the ChitFund when those come through.
  const { value, months, margin, start } = p.data;
  if (value || months || margin || start) {
    await prisma.chitFund.updateMany({
      where: { vendorId: id },
      data: {
        ...(value ? { chitValue: rupeesToPaise(value) } : {}),
        ...(months ? { durationMonths: Number(months) } : {}),
        ...(margin ? { marginInstallment: rupeesToPaise(margin) } : {}),
        ...(start ? { startedAt: parseFormDate(start) } : {}),
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
    data: { membershipId: p.data.membershipId, kind, reason, amount, occurredAt: istDate(p.data.date ? new Date(p.data.date) : new Date()), note: p.data.note || null },
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
      ...(date ? { occurredAt: istDate(new Date(date)) } : {}),
    },
  });
  revalidatePath(`/members/${memberId}`);
  return { ok: true };
}

// Delete a charge (obligation row) — charges never touch the ledger, so just remove the row.
// An AUTO penalty is voided (tombstoned) rather than deleted, so the next sync can't resurrect it
// by its deterministic id; a manual charge is removed outright as before.
async function deleteCharge(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  const memberId = str(fd, "memberId");
  if (!id || !memberId) return { ok: false, error: "Missing charge." };
  const charge = await prisma.charge.findUnique({ where: { id }, select: { auto: true } });
  if (charge?.auto) await prisma.charge.update({ where: { id }, data: { voidedAt: new Date() } });
  else await prisma.charge.delete({ where: { id } });
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/penalties");
  return { ok: true };
}

// Delete a recorded pay-down — post a reversing entry (§16). Routed through reverseTransaction so the
// closed-quarter lock, non-negative-treasury guard, and audit/reversal trail all apply (a direct
// balance decrement bypassed every one of them and lost the history).
async function deletePayment(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  const memberId = str(fd, "memberId");
  if (!id || !memberId) return { ok: false, error: "Missing payment." };
  try {
    await reverseTransaction(id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not delete the payment." };
  }
  revalidateLedger();
  revalidatePath(`/members/${memberId}`);
  return { ok: true };
}

// A ledger correction touches balances that feed every money view — revalidate them all.
function revalidateLedger() {
  for (const p of ["/transactions", "/dashboard", "/members", "/vendors", "/analytics", "/notifications", "/penalties"]) revalidatePath(p);
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
const rejoinSchema = z.object({
  memberId: z.string().min(1, "Missing member."),
  catchup: z.string().optional(),
  date: optDate,
  note: z.string().optional(),
});

async function rejoin(fd: FormData): Promise<ActionResult> {
  const parsed = rejoinSchema.safeParse({ memberId: str(fd, "memberId"), catchup: str(fd, "catchup"), date: str(fd, "date"), note: str(fd, "note") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { memberId } = parsed.data;
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, memberships: { select: { seq: true, status: true } } },
  });
  if (!member) return { ok: false, error: "Member not found." };
  if (member.memberships.some((s) => s.status === "ACTIVE")) return { ok: false, error: "This member is already active." };

  const catchup = rupeesToPaise(parsed.data.catchup ?? "");
  if (catchup < 0n) return { ok: false, error: "Catch-up can't be negative." };
  const date = istDate(parsed.data.date ? new Date(parsed.data.date) : new Date());
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
        data: { membershipId: ms.id, kind: "CATCHUP", reason: "REJOIN", amount: catchup, occurredAt: date, note: parsed.data.note || null },
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
  await bustStats();
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
  await bustStats();
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
  await bustStats();
  return { ok: true };
}

// Admin edits club settings (design "Edit club settings"): name & timezone are locked; the
// dividend toggle flips instantly; a new monthly-deposit amount or loan rate is an APPEND to the
// dated history (effective going forward — past records untouched). Both fields of a pair required.
// amountPaise is stored as a string: JSON has no BigInt, and Number() would down-cast paise into a
// float and lose precision on large money. The read side (queries/settings.ts, queries/members.ts)
// already parses it back with BigInt(), which accepts both string and legacy-number values.
type ClubStage = { name?: string; amountPaise: string; startDate: string; endDate?: string | null };
type ClubRate = { rateBps: number; effectiveFrom: string };

// The auto-penalty knobs (§13.2), all optional — a blank field keeps the current value. Both
// penalties share one effective-from date; each has its own on/off, rate %, and minimum trigger,
// and the loan-interest penalty adds a grace/tick window in days.
export interface PenaltyInput {
  penaltyFrom?: string; // yyyy-mm-dd (shared effective-from)
  depositPenaltyEnabled?: boolean; depositPenaltyRate?: string; depositPenaltyMin?: string; // %/mo, ₹
  interestPenaltyEnabled?: boolean; interestPenaltyRate?: string; interestPenaltyMin?: string; interestPenaltyGrace?: string; // %, ₹, days
}

// Overlay the submitted penalty knobs onto the current config (blank = keep). Returns the new config
// or a validation error string.
function buildPenaltyConfig(input: PenaltyInput, current: PenaltyConfig): PenaltyConfig | { error: string } {
  const num = (s: string | undefined, fallback: number): number | null => {
    const t = (s ?? "").trim();
    if (!t) return fallback;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const from = (input.penaltyFrom ?? "").trim();
  let effectiveFrom = current.effectiveFrom;
  if (from) {
    const d = new Date(from);
    if (Number.isNaN(d.getTime())) return { error: "Enter a valid penalty start date." };
    effectiveFrom = istDate(d);
  }
  const dRate = num(input.depositPenaltyRate, current.deposit.rateBps / 100);
  const iRate = num(input.interestPenaltyRate, current.interest.rateBps / 100);
  const grace = num(input.interestPenaltyGrace, current.interest.graceDays);
  if (dRate === null || iRate === null) return { error: "Penalty rate must be a positive percentage." };
  if (grace === null || grace < 1) return { error: "Grace period must be at least 1 day." };
  const dMin = (input.depositPenaltyMin ?? "").trim() ? rupeesToPaise(input.depositPenaltyMin!) : current.deposit.minPaise;
  const iMin = (input.interestPenaltyMin ?? "").trim() ? rupeesToPaise(input.interestPenaltyMin!) : current.interest.minPaise;
  if (dMin < 0n || iMin < 0n) return { error: "Penalty minimum can't be negative." };
  return {
    effectiveFrom,
    deposit: { enabled: input.depositPenaltyEnabled ?? current.deposit.enabled, rateBps: Math.round(dRate * 100), minPaise: dMin },
    interest: { enabled: input.interestPenaltyEnabled ?? current.interest.enabled, rateBps: Math.round(iRate * 100), minPaise: iMin, graceDays: Math.round(grace) },
  };
}

export async function saveClubSettings(input: {
  dividend: boolean;
  depositAmount?: string; depositFrom?: string; // ₹ + yyyy-mm-dd
  rate?: string; rateFrom?: string; // %/mo + yyyy-mm-dd
} & PenaltyInput): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me?.isAdmin) return { ok: false, error: "Only an admin can edit the club." };
  const cfg = await prisma.clubConfig.findUnique({ where: { id: "singleton" }, select: { stages: true, rateSchedule: true } });
  if (!cfg) return { ok: false, error: "Club config not found." };

  const data: { dividendEnabled: boolean; stages?: ClubStage[]; rateSchedule?: ClubRate[]; penaltyConfig?: object } = { dividendEnabled: input.dividend };

  const built = buildPenaltyConfig(input, await getPenaltyConfig());
  if ("error" in built) return { ok: false, error: built.error };
  data.penaltyConfig = serializePenaltyConfig(built);

  const depA = (input.depositAmount ?? "").trim();
  const depD = (input.depositFrom ?? "").trim();
  if (depA || depD) {
    if (!depA || !depD) return { ok: false, error: "Enter both a new deposit amount and its effective date." };
    const amount = rupeesToPaise(depA);
    if (amount <= 0n) return { ok: false, error: "Deposit amount must be greater than zero." };
    const from = new Date(depD);
    if (Number.isNaN(from.getTime())) return { ok: false, error: "Enter a valid deposit effective date." };
    const stages = ([...(cfg.stages as unknown as ClubStage[])]).sort((a, b) => a.startDate.localeCompare(b.startDate));
    const last = stages[stages.length - 1];
    if (last && depD <= last.startDate) return { ok: false, error: "Effective date must be after the current stage." };
    if (last) last.endDate = depD;
    stages.push({ name: `Stage ${stages.length + 1}`, amountPaise: amount.toString(), startDate: depD });
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
  // Turning a penalty on applies from the effective date immediately — materialise what's already due.
  await syncAutoPenaltiesSafe();
  for (const p of ["/settings", "/members", "/loans", "/dashboard", "/analytics", "/penalties"]) revalidatePath(p);
  await bustStats();
  return { ok: true };
}

// Admin "Sync now" on the auto-penalties page: force a materialisation pass and report how many
// new penalties were added. Duplicate-proof (deterministic ids), so it's safe to run any time.
export async function syncAutoPenaltiesNow(): Promise<ActionResult & { added?: number }> {
  const me = await getCurrentUser();
  if (!me?.isAdmin) return { ok: false, error: "Only an admin can do that." };
  try {
    const added = await syncAutoPenalties();
    for (const p of ["/penalties", "/members", "/dashboard"]) revalidatePath(p);
    await bustStats();
    return { ok: true, added };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not sync penalties." };
  }
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
  // A write-off posts to the ledger (receivable → profit), touching dashboard/analytics too.
  revalidateLedger();
  if (vendorId) revalidatePath(`/vendors/${vendorId}`);
  return { ok: true };
}

// Settle up & leave (PRODUCT.md §12): admin pays the member out in cash from a treasurer and closes
// their membership. Posts the settlement as REAL split legs — interest collected, loan repaid,
// capital returned, profit paid to PROFIT_DISTRIBUTED — grouped under one reference, and snapshots
// the guide on the membership (see settleMembership). Profit zeroes out once they're no longer active.
const settleSchema = z.object({
  memberId: z.string().min(1, "Missing member."),
  treasurerId: z.string().min(1, "Pick the treasurer paying the member out."),
  amount: z.string().optional(),
  date: optDate,
  note: z.string().optional(),
});

async function settle(fd: FormData): Promise<ActionResult> {
  const p = settleSchema.safeParse({ memberId: str(fd, "memberId"), treasurerId: str(fd, "treasurerId"), amount: str(fd, "amount"), date: str(fd, "date"), note: str(fd, "note") });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { memberId } = p.data;
  try {
    const ms = await prisma.membership.findFirst({ where: { memberId, status: "ACTIVE" }, orderBy: { seq: "desc" }, select: { id: true } });
    if (!ms) return { ok: false, error: "This member has no active membership to settle." };
    await settleMembership({
      membershipId: ms.id,
      treasurerMemberId: p.data.treasurerId,
      finalPaise: rupeesToPaise(p.data.amount || "0"),
      occurredAt: p.data.date ? new Date(p.data.date) : new Date(),
      note: p.data.note || null,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not settle the member." };
  }
  // Settlement posts real ledger legs (interest, loan, capital, profit) — invalidate every money view.
  revalidateLedger();
  revalidatePath(`/members/${memberId}`);
  return { ok: true };
}

/**
 * The submit → approve split (PRODUCT.md §15). An admin's own money entry posts to the ledger
 * immediately; a member's entry becomes a PENDING submission that reaches every admin's inbox and
 * only posts on approval. Shared by every money-entry surface (top-bar entry, catch-up/penalty
 * payment, vendor return, …) so the rule is enforced in exactly one place.
 */
async function postOrSubmit(intent: string, payload: Record<string, string>, revalidate: () => void): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in." };
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload)) if (v) clean[k] = v;

  if (me.isAdmin) {
    await postIntent({ intent, ...clean }, me.id);
    revalidate();
    return { ok: true };
  }
  // Member: queue a pending request for an admin to approve.
  const submission = await prisma.submission.create({ data: { intent, payload: clean, status: "PENDING", submittedById: me.id } });
  const admins = await prisma.member.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  const body = clean.party ? `${clean.party} · ${clean.amount ?? ""}`.trim() : null;
  await prisma.notification.createMany({
    data: admins.map((a) => ({ recipientId: a.id, kind: "APPROVAL" as const, type: "submission.pending", title: intent, body, link: "/notifications", submissionId: submission.id })),
  });
  revalidatePath("/notifications");
  return { ok: true };
}

// Record a catch-up / penalty pay-down → admin posts directly, member submits for approval (§15).
async function recordPayment(fd: FormData): Promise<ActionResult> {
  const memberId = str(fd, "memberId");
  const isPenalty = str(fd, "type").toLowerCase().startsWith("pen");
  return postOrSubmit(
    isPenalty ? "Delayed-payment penalty" : "Catch-up payment",
    { party: str(fd, "party"), partyId: memberId, amount: str(fd, "amount"), treasurer: str(fd, "treasurer"), date: str(fd, "date"), note: str(fd, "note") },
    () => revalidatePath(`/members/${memberId}`),
  );
}

// Edit a recorded payment's amount / date. Routed through editTransactionAmount (reverse + repost)
// so it goes through rebuildLines — which balances every posting shape, not just 2-leg ones — and
// through the closed-quarter lock + audit trail. The old in-place re-scale wrote ±amount to every
// leg, which silently corrupted any 3-leg posting (e.g. a vendor return) and bypassed the lock.
async function editPayment(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  const memberId = str(fd, "memberId");
  if (!id || !memberId) return { ok: false, error: "Missing payment." };
  const amount = rupeesToPaise(str(fd, "amount"));
  if (amount <= 0n) return { ok: false, error: "Enter an amount greater than zero." };
  try {
    await editTransactionAmount(id, amount, str(fd, "date") || undefined);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not edit the payment." };
  }
  revalidateLedger();
  revalidatePath(`/members/${memberId}`);
  return { ok: true };
}

const entrySchema = z.object({
  intent: z.string().min(1, "Pick what happened."),
  party: z.string().optional(),
  partyId: z.string().optional(),
  amount: z.string().optional(),
  date: optDate,
  treasurer: z.string().optional(),
  treasurerId: z.string().optional(),
  note: z.string().optional(),
  principal: z.string().optional(),
});

// Top-bar "Add entry": admin posts to the ledger immediately, member queues a pending request (§15).
async function submitEntry(fd: FormData): Promise<ActionResult> {
  const p = entrySchema.safeParse({
    intent: str(fd, "intent"), party: str(fd, "party"), partyId: str(fd, "partyId"), amount: str(fd, "amount"),
    date: str(fd, "date"), treasurer: str(fd, "treasurer"), treasurerId: str(fd, "treasurerId"), note: str(fd, "note"), principal: str(fd, "principal"),
  });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const payload: Record<string, string> = {};
  for (const [key, v] of Object.entries(p.data)) {
    if (typeof v === "string" && v) payload[key] = v;
  }
  return postOrSubmit(payload.intent, payload, revalidateLedger);
}
