import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/queries/session";
import { cachedStats } from "@/server/stats";
import { getAutoPenaltiesData } from "@/server/queries/penalties";

// Admin-only: the auto-penalty register lists what the system charged across every member (§13.2).
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!me.isAdmin) return NextResponse.json({ error: "Only an admin can view auto penalties." }, { status: 403 });
  try {
    return NextResponse.json(await cachedStats("penalties", getAutoPenaltiesData));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Request failed." }, { status: 500 });
  }
}
