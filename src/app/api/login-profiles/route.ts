import { NextResponse } from "next/server";
import { getLoginProfiles } from "@/features/auth/queries";

// Public (pre-auth) sign-in directory for the mobile app's profile-picker —
// the same data the web /login page already renders before sign-in.
export async function GET() {
  return NextResponse.json(await getLoginProfiles());
}
