import "server-only";
import { prisma } from "@/server/db";

type NotifRow = {
  recipientId: string;
  kind: "EVENT" | "APPROVAL";
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  submissionId?: string;
};

/**
 * The single place a Notification row is born: stores the in-app rows, then fans out an Expo
 * push to every registered device of each recipient. Push is fire-and-forget — a push failure
 * never fails the action that triggered it (Phase 5: no retry queue).
 */
export async function createNotifications(data: NotifRow[]): Promise<void> {
  if (!data.length) return;
  await prisma.notification.createMany({ data });
  try {
    await sendPush(data);
  } catch {
    // best-effort: Expo down or network hiccup — the in-app notification already exists
  }
}

async function sendPush(data: NotifRow[]): Promise<void> {
  const tokens = await prisma.pushToken.findMany({
    where: { memberId: { in: data.map((d) => d.recipientId) } },
    select: { memberId: true, token: true },
  });
  if (!tokens.length) return;

  const byMember = new Map<string, string[]>();
  for (const t of tokens) byMember.set(t.memberId, [...(byMember.get(t.memberId) ?? []), t.token]);

  // `link` rides along as data so the app can deep-link on tap (mobile route paths match web's).
  const messages = data.flatMap((d) =>
    (byMember.get(d.recipientId) ?? []).map((to) => ({
      to,
      title: d.title,
      body: d.body ?? undefined,
      data: { link: d.link ?? "/notifications" },
    })),
  );

  // Expo's push API accepts ≤100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
    const tickets: { status: string; details?: { error?: string } }[] =
      (await res.json().catch(() => null))?.data ?? [];
    // Expo flags uninstalled devices — drop those tokens so the table doesn't rot.
    const dead = tickets.flatMap((t, j) =>
      t.status === "error" && t.details?.error === "DeviceNotRegistered" ? [batch[j].to] : [],
    );
    if (dead.length) await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
  }
}
