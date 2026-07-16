import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/queries/session";

// The mobile app registers its Expo push token here after login (peacock-mobile Phase 5).
// Upsert on token: re-login on the same device re-points it, a second device adds a row.
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const token = (await req.json().catch(() => ({})))?.token;
  if (typeof token !== "string" || !token.startsWith("ExponentPushToken")) {
    return NextResponse.json({ error: "Bad token." }, { status: 400 });
  }
  await prisma.pushToken.upsert({
    where: { token },
    update: { memberId: me.id },
    create: { token, memberId: me.id },
  });
  return NextResponse.json({ ok: true });
}
