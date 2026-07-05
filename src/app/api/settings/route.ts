import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/queries/session";
import { getSettingsData } from "@/server/queries/settings";

// Contains the signed-in member's own profile — per-user, so never stats-cached.
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const data = await getSettingsData();
    return NextResponse.json({ ...data, isAdmin: me.isAdmin });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Request failed." }, { status: 500 });
  }
}
