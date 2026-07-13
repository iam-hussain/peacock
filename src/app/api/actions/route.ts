import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { decideSubmission, formAction, markAllRead, updateAvatar } from "@/server/actions";
import { getCurrentUser } from "@/server/queries/session";

/**
 * Mutations dispatcher for the native app (peacock-mobile): JSON `{ kind, payload }`
 * → the same server-action layer the web forms use. Role gating lives in
 * actions.ts (SELF_SERVICE set + requireAdmin), not here — one gate, no drift.
 */
const bodySchema = z.object({
  kind: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(req: NextRequest) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Expected { kind, payload }." }, { status: 400 });
  }
  const { kind, payload } = body;

  try {
    // Kinds with dedicated server actions (not FormData-shaped).
    if (kind === "decideSubmission") {
      const p = z.object({ id: z.string(), decision: z.enum(["approve", "reject"]) }).parse(payload);
      return respond(await decideSubmission(p.id, p.decision));
    }
    if (kind === "markAllRead") return respond(await markAllRead());
    if (kind === "updateAvatar") {
      const p = z.object({ dataUrl: z.string() }).parse(payload);
      return respond(await updateAvatar(p.dataUrl));
    }

    // Everything else routes through formAction's kind switch, exactly like a web form post.
    const fd = new FormData();
    for (const [k, v] of Object.entries(payload)) {
      if (v !== undefined && v !== null) fd.set(k, String(v));
    }
    return respond(await formAction(kind, fd));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Request failed." },
      { status: 500 },
    );
  }
}

function respond(res: { ok: boolean; error?: string; deferred?: boolean }) {
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
