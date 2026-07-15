import "server-only";
import { prisma } from "@/server/db";
import { auth } from "@/server/auth";
import { sendText } from "./send";
import type { WaSender } from "./identity";

/**
 * Self-service login help over WhatsApp — the member's number is already OTP-verified by Meta
 * (identity.ts matched it to Member.phone), so a message from that number is proof enough to:
 *   • reset their password back to the default (their phone number), or
 *   • hand them a one-time "quick login" magic link (no password at all).
 * The website never initiates a message — the member opens the chat (wa.me link on the login
 * screen), which also opens WhatsApp's free 24-hour reply window so our replies cost nothing.
 */

const RESET = /^\s*(reset(\s+my)?\s+password|forgot(\s+password)?|password\s+reset)\s*$/i;
const QUICK_LOGIN = /^\s*(quick\s*login|log\s*in(\s+link)?|login\s+link|magic\s*link|sign\s*in(\s+link)?)\s*$/i;

export const looksLikeReset = (text: string): boolean => RESET.test(text);
export const looksLikeQuickLogin = (text: string): boolean => QUICK_LOGIN.test(text);

const firstName = (name: string) => name.split(" ")[0];

/** Reset the sender's own password to their phone number (the default) and force a change on next
 *  login — mirrors the admin resetPassword action, but self-served from the verified number. */
export async function resetPasswordFor(sender: WaSender, waId: string): Promise<void> {
  const member = await prisma.member.findUnique({
    where: { id: sender.id },
    select: { phone: true, userId: true },
  });
  if (!member?.userId) {
    return sendText(waId, "⚠️ Your number isn't linked to a login account yet.\n\nAsk an admin to set one up for you.");
  }
  const newPassword = member.phone ?? "";
  if (newPassword.length < 6) {
    return sendText(waId, "⚠️ Couldn't reset — there's no valid phone number on your profile to use as the default.\n\nAsk an admin to reset it for you.");
  }
  try {
    const ctx = await auth.$context;
    const hash = await ctx.password.hash(newPassword);
    await ctx.internalAdapter.updatePassword(member.userId, hash);
    await prisma.member.update({ where: { id: sender.id }, data: { mustChangePassword: true } });
  } catch (e) {
    console.error("WhatsApp password reset failed:", e);
    return sendText(waId, "⚠️ Something went wrong resetting your password. Please try again in a moment, or ask an admin.");
  }
  return sendText(
    waId,
    `🔐 *Password reset*\n\nDone, ${firstName(sender.name)}! Your password is now your *phone number* (the one registered here).\n\nOpen the app, pick your name, and sign in with it — you'll be asked to set a new password once you're in.\n\n_Prefer no password at all? Send *quick login* for a one-tap sign-in link._`,
  );
}

/** Kick off a passwordless magic link for the sender — Better Auth mints the one-time token and
 *  calls our sendMagicLink hook (auth/index.ts), which delivers the URL back over WhatsApp. */
export async function sendQuickLoginLink(sender: WaSender, waId: string): Promise<void> {
  const member = await prisma.member.findUnique({
    where: { id: sender.id },
    select: { user: { select: { email: true } } },
  });
  const email = member?.user?.email;
  if (!email) {
    return sendText(waId, "⚠️ Your number isn't linked to a login account yet.\n\nAsk an admin to set one up for you.");
  }
  try {
    // Server-to-server call (no inbound browser request) — the endpoint requires a headers object,
    // so hand it an empty one; there's no origin to CSRF-check on a webhook-triggered send.
    await auth.api.signInMagicLink({ body: { email, callbackURL: "/dashboard" }, headers: new Headers() });
  } catch (e) {
    console.error("WhatsApp quick-login failed:", e);
    return sendText(waId, "⚠️ Couldn't create your login link just now. Please try again in a moment, or ask an admin.");
  }
}
