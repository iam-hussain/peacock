import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
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
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    // Short-lived signed cookie mirror of the session: most getSession calls skip the DB
    // entirely and only re-verify against Mongo every 5 minutes (or on sign-out).
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
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
