import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Guard the authenticated app shell. Optimistic cookie check only (no DB at the
// edge) — the server still resolves the real session for data access.
const PROTECTED = [
  "/dashboard",
  "/members",
  "/loans",
  "/vendors",
  "/transactions",
  "/audit",
  "/notifications",
  "/analytics",
  "/settings",
  "/more",
  "/share",
];

// CORS for /api/* — consumed cross-origin by the Expo app (peacock-mobile). Native fetches send
// no Origin header (CORS doesn't apply there); this exists for Expo Web dev (http://localhost:8081)
// and any other browser client. Auth is cookie-based, so we must echo back an allowlisted origin —
// a `*` wildcard can't carry credentials. Allowlist = CORS_ORIGINS env (comma-separated full
// origins) plus any localhost origin in dev.
const allowlist = (process.env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const allowedOrigin = (origin: string) =>
  allowlist.includes(origin) ||
  (process.env.NODE_ENV === "development" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));

function cors(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || !allowedOrigin(origin)) return NextResponse.next(); // same-origin / native / untrusted

  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      },
    });
  }
  const res = NextResponse.next();
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.append("Vary", "Origin");
  return res;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/")) return cors(req);
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!needsAuth) return NextResponse.next();

  if (!getSessionCookie(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/members/:path*",
    "/loans/:path*",
    "/vendors/:path*",
    "/transactions/:path*",
    "/audit/:path*",
    "/notifications/:path*",
    "/analytics/:path*",
    "/settings/:path*",
    "/more/:path*",
    "/share/:path*",
  ],
};
