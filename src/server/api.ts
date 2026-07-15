import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/queries/session";

/**
 * Auth-guarded JSON GET body for the page-data API routes: 401 signed-out, 500 with the error
 * message on failure. `fn` may return a NextResponse (e.g. a 404) to pass through untouched.
 */
export async function guarded(fn: () => Promise<unknown>): Promise<NextResponse> {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const out = await fn();
    return out instanceof NextResponse ? out : NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Request failed." }, { status: 500 });
  }
}

/** Like `guarded`, but the caller must be an admin (403 otherwise) — for admin-only page data. */
export async function guardedAdmin(fn: () => Promise<unknown>): Promise<NextResponse> {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!me.isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  try {
    const out = await fn();
    return out instanceof NextResponse ? out : NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Request failed." }, { status: 500 });
  }
}
