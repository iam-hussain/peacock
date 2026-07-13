import "server-only";

/**
 * Outbound WhatsApp Cloud API calls (docs: developers.facebook.com/docs/whatsapp/cloud-api).
 * One club-level token sends to any member — members never authenticate; their WhatsApp
 * number IS their identity (matched to Member.phone in identity.ts).
 */

// Overridable so local verification can point sends at a capture server instead of Meta.
const GRAPH = process.env.WHATSAPP_GRAPH_URL || "https://graph.facebook.com/v21.0";

export const whatsappConfigured = () =>
  Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

async function send(payload: Record<string, unknown>): Promise<void> {
  if (!whatsappConfigured()) return; // bot disabled — webhook still 200s so Meta doesn't retry
  const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  // A failed reply must never fail the webhook (Meta would redeliver the inbound message).
  if (!res.ok) console.error("WhatsApp send failed:", res.status, await res.text());
}

export const sendText = (to: string, body: string) => send({ to, type: "text", text: { body } });

export interface ReplyButton {
  id: string; // echoed back as button_reply.id (≤256 chars)
  title: string; // ≤20 chars
}

/** Interactive quick-reply buttons (max 3) — used for the Confirm/Cancel entry step. */
export const sendButtons = (to: string, body: string, buttons: ReplyButton[]) =>
  send({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: { buttons: buttons.map((b) => ({ type: "reply" as const, reply: b })) },
    },
  });
