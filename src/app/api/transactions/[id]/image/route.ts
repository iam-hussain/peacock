import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/queries/session";

/**
 * Serve a transaction's proof image as raw bytes so the ledger list can show it via a plain
 * `<img src>` without ever pulling the base64 blob into the cached DTO (see queries/transactions.ts,
 * which only carries a `hasImage` flag). Auth-gated; decodes the stored data URL back to bytes.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;
  const txn = await prisma.transaction.findUnique({ where: { id }, select: { attachment: true } });
  const m = txn?.attachment ? /^data:(image\/(?:png|jpeg));base64,(.+)$/s.exec(txn.attachment) : null;
  if (!m) return NextResponse.json({ error: "No image." }, { status: 404 });
  const [, mime, b64] = m;
  return new NextResponse(Buffer.from(b64, "base64"), {
    headers: { "Content-Type": mime, "Cache-Control": "private, max-age=3600" },
  });
}
