import { NextResponse } from "next/server";
import { guarded } from "@/server/api";
import { cachedStats } from "@/server/stats";
import { getChitDetail, getGeneralDetail } from "@/server/queries/vendors";

// Discriminated union so the client renders the right detail view without re-probing.
export type VendorDetailPayload =
  | { kind: "chit"; detail: NonNullable<Awaited<ReturnType<typeof getChitDetail>>> }
  | { kind: "general"; detail: NonNullable<Awaited<ReturnType<typeof getGeneralDetail>>> };

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return guarded(async () => {
    const payload = await cachedStats<VendorDetailPayload | null>(`vendor:${id}`, async () => {
      const c = await getChitDetail(id);
      if (c) return { kind: "chit", detail: c };
      const g = await getGeneralDetail(id);
      if (g) return { kind: "general", detail: g };
      return null;
    });
    return payload ?? NextResponse.json({ error: "Vendor not found." }, { status: 404 });
  });
}
