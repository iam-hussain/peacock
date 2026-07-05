import { NextResponse } from "next/server";
import { guarded } from "@/server/api";
import { cachedStats } from "@/server/stats";
import { getMemberDetail } from "@/server/queries/members";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return guarded(async () => {
    const m = await cachedStats(`member:${id}`, () => getMemberDetail(id));
    return m ?? NextResponse.json({ error: "Member not found." }, { status: 404 });
  });
}
