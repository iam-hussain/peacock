import "server-only";
import { prisma } from "@/server/db";
import { fullLedger } from "./transactions";
import { dayMonthYear } from "@/lib/date";

export interface AuditGroup {
  date: string;
  items: { act: string; who: string; when: string; type: string }[];
}

// ponytail: AuditLog rows aren't written by the import seed, so the audit feed is
// derived from the ledger itself — every posting is an action. When real actor
// tracking lands (createdById on transactions), swap the source to AuditLog.
export async function getAuditFeed(): Promise<{ groups: AuditGroup[]; total: number }> {
  const txns = await fullLedger(); // shared StatsCache memo — no second ledger map on cold compute
  const now = new Date();
  const today = dayMonthYear(now);
  const yesterday = dayMonthYear(new Date(now.getTime() - 86_400_000));
  const bucket = (date: string) => (date === today ? "Today" : date === yesterday ? "Yesterday" : date);

  const groups: AuditGroup[] = [];
  for (const t of txns) {
    const other = t.dir === "out" ? t.to.name : t.from.name;
    const who = t.dir === "out" ? t.from.name : t.to.name;
    const label = bucket(t.date);
    const item = { act: `${t.what} ${t.amount} · ${other}`, who, when: t.entered, type: "Entries" };
    const last = groups[groups.length - 1];
    if (last && last.date === label) last.items.push(item);
    else groups.push({ date: label, items: [item] });
  }
  return { groups, total: await prisma.transaction.count({ where: { entries: { none: { accountId: "club-opening" } } } }) };
}
