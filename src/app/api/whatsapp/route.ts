import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { handleIncoming } from "@/server/whatsapp/router";

/**
 * WhatsApp Cloud API webhook. GET = Meta's one-time URL verification handshake;
 * POST = inbound messages, authenticated by the X-Hub-Signature-256 HMAC (app secret).
 * The club authenticates to Meta with ONE server-held token (send.ts) — members never
 * log in anywhere; their WhatsApp-verified number is matched to Member.phone.
 */

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed." }, { status: 403 });
}

// Unset secret = check skipped (local dev only — same convention as CRON_SECRET); ALWAYS set in production.
function signedByMeta(req: Request, rawBody: string): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true;
  const theirs = req.headers.get("x-hub-signature-256") ?? "";
  const ours = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return theirs.length === ours.length && crypto.timingSafeEqual(Buffer.from(theirs), Buffer.from(ours));
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!signedByMeta(req, raw)) return NextResponse.json({ error: "Bad signature." }, { status: 401 });

  // Always 200 past this point — a non-200 makes Meta redeliver the same message repeatedly.
  try {
    const value = JSON.parse(raw)?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0]; // absent for delivery/read status callbacks
    if (msg?.from) {
      await handleIncoming(msg.from, {
        text: msg.type === "text" ? msg.text?.body : undefined,
        buttonId: msg.type === "interactive" ? msg.interactive?.button_reply?.id : undefined,
      });
    }
  } catch (e) {
    console.error("WhatsApp webhook failed:", e);
  }
  return NextResponse.json({ ok: true });
}
