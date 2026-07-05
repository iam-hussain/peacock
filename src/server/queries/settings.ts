import "server-only";
import { prisma } from "@/server/db";
import { formatLakh, formatPaise } from "@/lib/money";
import { dayMonthYear } from "@/lib/date";
import { getCurrentUser } from "./session";
import { getQuarterPreview, type QuarterPreview } from "./close-quarter";

interface Stage {
  amountPaise: number;
  startDate: string;
  endDate?: string | null;
}
interface RatePoint {
  rateBps: number;
  effectiveFrom: string;
}

export interface SettingsData {
  club: {
    name: string; meta: string; deposit: string; rate: string; loanLimit: string;
    term: string; cooldown: string; overdue: string; dividend: string; timezone: string;
    // current values used to pre-fill / label the Edit-club form (design: name & timezone locked)
    edit: { name: string; currentDeposit: string; currentRate: string; dividend: boolean; timezone: string };
    history: {
      stages: { amount: string; range: string }[];
      rates: { rate: string; range: string; current: boolean }[];
      dailyFrom: string;
    };
  };
  treasury: { name: string; holds: string }[];
  profile: { id: string; name: string; phone: string; username: string; email: string; role: string; isTreasurer: boolean; avatarUrl: string };
  admins: { id: string; name: string; holds: string }[];
  memberOptions: { label: string; value: string; sub: string }[];
  quarter: QuarterPreview;
  auditCount: number;
}

const yr = (d: string) => new Date(d).getUTCFullYear();
const fullName = (f: string, l?: string | null) => [f, l].filter(Boolean).join(" ");

export async function getSettingsData(): Promise<SettingsData> {
  const cfg = await prisma.clubConfig.findUnique({ where: { id: "singleton" } });
  const memberCount = await prisma.member.count();
  const stages = (cfg?.stages as unknown as Stage[] | undefined) ?? [];
  const deposit = stages.length ? formatPaise(BigInt(stages[stages.length - 1].amountPaise)) : "—";
  const rateSched = (cfg?.rateSchedule as unknown as RatePoint[] | undefined) ?? [];
  const rateBps = rateSched.length ? rateSched[rateSched.length - 1].rateBps : 100;
  const rateLabel = `${rateBps / 100}% / mo`;

  const treasurers = (
    await prisma.member.findMany({
      where: { treasury: { some: {} } },
      select: { firstName: true, lastName: true, treasury: { select: { balance: true } } },
    })
  ).sort((a, b) => Number((b.treasury[0]?.balance ?? 0n) - (a.treasury[0]?.balance ?? 0n)));

  const user = await getCurrentUser();
  const me = user ? await prisma.member.findUnique({ where: { id: user.id }, select: { phone: true, username: true, avatarUrl: true, role: true, isTreasurer: true } }) : null;

  const members = await prisma.member.findMany({ select: { id: true, firstName: true, lastName: true, phone: true }, orderBy: { firstName: "asc" } });

  const adminRows = await prisma.member.findMany({
    where: { role: "ADMIN" },
    select: { id: true, firstName: true, lastName: true, treasury: { select: { balance: true } } },
    orderBy: { firstName: "asc" },
  });

  const [quarter, auditCount] = await Promise.all([getQuarterPreview(), prisma.auditLog.count()]);

  const overduePct = (cfg?.overduePenaltyBps ?? 0) / 100;

  return {
    club: {
      name: cfg?.name ?? "Peacock Investment Club",
      meta: `${memberCount} members · started ${cfg ? cfg.startedAt.getUTCFullYear() : ""}`,
      deposit,
      rate: rateLabel,
      loanLimit: cfg ? formatLakh(cfg.maxLoanPaise) : "—",
      term: `${cfg?.loanTermMonths ?? 5} months`,
      cooldown: `${cfg?.loanCooldownMonths ?? 1} month`,
      overdue: `${overduePct}%`,
      dividend: cfg?.dividendEnabled ? "On" : "Off",
      timezone: cfg?.timezone ?? "Asia/Kolkata",
      edit: {
        name: cfg?.name ?? "Peacock Investment Club",
        currentDeposit: deposit,
        currentRate: rateLabel,
        dividend: cfg?.dividendEnabled ?? false,
        timezone: cfg?.timezone ?? "Asia/Kolkata",
      },
      history: {
        stages: stages.map((s, i) => ({
          amount: formatPaise(BigInt(s.amountPaise)),
          range: `${yr(s.startDate)} – ${s.endDate ? yr(s.endDate) : i === stages.length - 1 ? "present" : yr(stages[i + 1].startDate)}`,
        })),
        rates: rateSched.map((r, i) => ({
          rate: `${r.rateBps / 100}% / mo`,
          range: `${yr(r.effectiveFrom)} – ${i === rateSched.length - 1 ? "present" : yr(rateSched[i + 1].effectiveFrom)}`,
          current: i === rateSched.length - 1,
        })),
        dailyFrom: cfg ? dayMonthYear(cfg.dayInterestFrom) : "—",
      },
    },
    treasury: treasurers.map((t) => ({ name: fullName(t.firstName, t.lastName), holds: formatLakh(t.treasury[0]?.balance ?? 0n) })),
    profile: {
      id: user?.id ?? "",
      name: user?.name ?? "",
      phone: me?.phone ?? "",
      username: me?.username ?? "",
      email: user?.email ?? "",
      role: me?.role === "ADMIN" ? "Admin" : "Member",
      isTreasurer: me?.isTreasurer ?? false,
      avatarUrl: me?.avatarUrl ?? "",
    },
    admins: adminRows.map((a) => ({ id: a.id, name: fullName(a.firstName, a.lastName), holds: a.treasury[0] ? formatLakh(a.treasury[0].balance) : "" })),
    memberOptions: members.map((m) => ({ label: fullName(m.firstName, m.lastName), value: m.id, sub: m.phone })),
    quarter,
    auditCount,
  };
}
