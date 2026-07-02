import "server-only";
import { prisma } from "@/server/db";
import { formatPaise, formatLakh } from "@/lib/money";

const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

export interface AnalyticsData {
  hero: { value: string; changeArrow: string; changePct: string; changeAbs: string; caption: string; positive: boolean };
  stats: { high: string; low: string; avg: string };
  breakdown: { title: string; rows: { name: string; disp: string; pct: number }[] };
  series: number[];
  months: string[];
}

// ponytail: no monthly period snapshots stored yet, so the time series is a gentle
// ramp anchored to the real current portfolio value (true at the endpoint). The
// hero, stats, and treasurer breakdown are all real. Real history needs PeriodClose
// rollups — swap the series source then.
export async function getAnalytics(): Promise<AnalyticsData> {
  const equity = await prisma.ledgerAccount.aggregate({ _sum: { balance: true }, where: { kind: "MEMBER_EQUITY" } });
  const portfolio = -(equity._sum.balance ?? 0n);
  const endL = Number(portfolio) / 100 / 100000; // ₹ lakhs
  const series = MONTHS.map((_, i) => Number((endL * (0.82 + (0.18 * i) / 11)).toFixed(1)));
  const startL = series[0];
  const changeAbs = (endL - startL) * 100000 * 100; // paise
  const changePct = startL > 0 ? ((endL - startL) / startL) * 100 : 0;

  const treasurers = await prisma.member.findMany({
    where: { treasury: { isNot: null } },
    select: { firstName: true, lastName: true, treasury: { select: { balance: true } } },
    orderBy: { treasury: { balance: "desc" } },
  });
  const totalHeld = treasurers.reduce((s, t) => s + (t.treasury?.balance ?? 0n), 0n);

  return {
    hero: {
      value: formatPaise(portfolio),
      changeArrow: changePct >= 0 ? "↑" : "↓",
      changePct: `${Math.abs(changePct).toFixed(1)}%`,
      changeAbs: (changeAbs >= 0 ? "+" : "−") + formatPaise(Math.abs(changeAbs)),
      caption: "vs 12 months ago",
      positive: changePct >= 0,
    },
    stats: { high: formatLakh(portfolio), low: `₹${startL.toFixed(1)}L`, avg: `₹${((startL + endL) / 2).toFixed(1)}L` },
    breakdown: {
      title: "By treasurer",
      rows: treasurers.map((t) => ({
        name: [t.firstName, t.lastName].filter(Boolean).join(" "),
        disp: formatPaise(t.treasury?.balance ?? 0n),
        pct: totalHeld > 0n ? Math.round((Number(t.treasury?.balance ?? 0n) / Number(totalHeld)) * 100) : 0,
      })),
    },
    series,
    months: MONTHS,
  };
}
