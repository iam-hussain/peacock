import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/queries/session";
import { getUnreadCount } from "@/server/queries/notifications";

// Session + bell badge for the client shell. Per-user; cookieCache already makes it cheap.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  return NextResponse.json({ user, unread: await getUnreadCount() });
}
