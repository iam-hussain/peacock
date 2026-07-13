import { NextResponse } from "next/server";
import { cronAuthorized } from "@/server/cron";
import { buildBackupJson } from "@/server/backup-data";

// Monthly backup (vercel.json cron, 1st ~10:00 IST): the same JSON the admin's Backup button
// produces, emailed to the admin via Resend. Env-gated — without RESEND_API_KEY + BACKUP_EMAIL_TO
// it reports "skipped" instead of failing, so the cron never error-spams an unconfigured deploy.
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const key = process.env.RESEND_API_KEY;
  const to = process.env.BACKUP_EMAIL_TO;
  if (!key || !to) return NextResponse.json({ ok: false, skipped: "Set RESEND_API_KEY and BACKUP_EMAIL_TO to enable emailed backups." });

  const json = await buildBackupJson();
  const date = new Date().toISOString().slice(0, 10);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.BACKUP_EMAIL_FROM ?? "Peacock <onboarding@resend.dev>",
      to: [to],
      subject: `Peacock backup — ${date}`,
      text: "Automated monthly Peacock database backup. Restore via Admin → Backup → Restore.",
      attachments: [{ filename: `peacock-backup-${date}.json`, content: Buffer.from(json).toString("base64") }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json({ ok: false, error: `Resend ${res.status}: ${detail.slice(0, 300)}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true, bytes: json.length });
}
