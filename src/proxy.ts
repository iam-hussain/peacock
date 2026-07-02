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

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
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
