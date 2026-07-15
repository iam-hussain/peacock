import { NextResponse } from "next/server";
import { guardedAdmin } from "@/server/api";
import { getWhatsappStats, getMemberChat } from "@/server/queries/whatsapp-stats";

/**
 * Admin WhatsApp usage dashboard data. `?member=<id>` (optional `&date=yyyy-mm-dd`) returns that
 * member's conversation thread; otherwise the whole-club usage overview. Not memoised in StatsCache
 * — the chat log changes on every message and isn't part of the money read-cache.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const member = url.searchParams.get("member");
  const date = url.searchParams.get("date") ?? undefined;
  return guardedAdmin(async () => {
    if (member) {
      const chat = await getMemberChat(member, date);
      return chat ?? NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
    return getWhatsappStats();
  });
}
