import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import { z } from "zod";
import { prisma } from "@/server/db";

/**
 * Fail fast if auth env is missing: without BETTER_AUTH_SECRET, sessions would be
 * signed with an undefined/weak secret silently. BETTER_AUTH_URL is required so
 * callbacks/cookies resolve to the right origin.
 */
const authEnv = z
  .object({
    BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
    BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),
  })
  .parse({
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  });

/**
 * Better Auth server instance (§ intended stack). Email + password only — members
 * sign in with their club email; the default password is their phone number, and
 * Member.mustChangePassword forces a change on first login (enforced in the UI seam).
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "mongodb" }),
  // Native app support (peacock-mobile): cookie-in-header auth for Expo SecureStore
  // clients. Pairs with the "peacock://" trusted origin below.
  plugins: [expo()],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    // Short-lived signed cookie mirror of the session: most getSession calls skip the DB
    // entirely and only re-verify against Mongo every 5 minutes (or on sign-out).
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  // Passwordless "quick login" (§ Logging in): the WhatsApp bot triggers a magic link for the
  // member (server-side, from the inbound webhook), and we deliver the one-time URL back over
  // WhatsApp — never by email. disableSignUp keeps it members-only (no link ever creates a user).
  plugins: [
    magicLink({
      expiresIn: 60 * 10, // 10 minutes, single-use
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        // The member's registered phone IS the number they just messaged us from (identity.ts
        // matched them by it), so replying to it stays inside WhatsApp's free 24-hour window.
        const member = await prisma.member.findFirst({
          where: { user: { email } },
          select: { phone: true, firstName: true },
        });
        if (!member?.phone) return;
        const { sendText } = await import("@/server/whatsapp/send");
        await sendText(
          member.phone.replace(/\D/g, ""),
          `⚡ *Quick login to Peacock*\n\nHi ${member.firstName}! Tap to open the app already signed in — no password needed:\n${url}\n\n_This link works once and expires in 10 minutes. If you didn't ask to log in, just ignore this message._`,
        );
      },
    }),
  ],
  secret: authEnv.BETTER_AUTH_SECRET,
  baseURL: authEnv.BETTER_AUTH_URL,
  // Mobile clients: Expo web dev server + the native app scheme. Without these,
  // better-auth CSRF-rejects cross-origin sign-in POSTs. CORS_ORIGINS mirrors the
  // /api CORS allowlist in src/proxy.ts so both layers trust the same origins.
  trustedOrigins: [
    "peacock://",
    ...(process.env.CORS_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ],
});

export type Session = typeof auth.$Infer.Session;
