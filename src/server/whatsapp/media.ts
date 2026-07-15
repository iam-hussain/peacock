import "server-only";

/**
 * Download an inbound WhatsApp image and return it as a self-describing data URL
 * (data:image/jpeg;base64,…), ready to store on a Transaction as proof.
 *
 * The Cloud API delivers media in two hops: GET /{media-id} → a short-lived, auth-gated URL, then
 * GET that URL (same Bearer token) → the bytes. WhatsApp only sends images as JPEG or PNG, so no
 * server-side re-encoding is needed; anything else, or anything too large to keep in a document, is
 * skipped (null) rather than stored. All failures are swallowed — a missing image must never break
 * recording the entry.
 */

const GRAPH = process.env.WHATSAPP_GRAPH_URL || "https://graph.facebook.com/v21.0";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB raw — comfortably inside Mongo's 16 MB document limit once base64'd
const ALLOWED = new Set(["image/jpeg", "image/png"]);

export interface DownloadedImage {
  dataUrl: string; // data:image/jpeg;base64,…
  mimeType: string;
}

export async function downloadMedia(mediaId: string): Promise<DownloadedImage | null> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token || !mediaId) return null;
  const auth = { Authorization: `Bearer ${token}` };
  try {
    const metaRes = await fetch(`${GRAPH}/${mediaId}`, { headers: auth });
    if (!metaRes.ok) return null;
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string; file_size?: number };
    if (!meta.url) return null;
    const mimeType = (meta.mime_type ?? "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED.has(mimeType)) return null; // images only, JPEG/PNG only
    if (meta.file_size && meta.file_size > MAX_BYTES) return null;

    const binRes = await fetch(meta.url, { headers: auth });
    if (!binRes.ok) return null;
    const buf = Buffer.from(await binRes.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) return null;
    return { dataUrl: `data:${mimeType};base64,${buf.toString("base64")}`, mimeType };
  } catch (e) {
    console.error("WhatsApp media download failed:", e);
    return null;
  }
}
