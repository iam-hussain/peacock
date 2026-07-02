import "server-only";
import { prisma } from "@/server/db";
import { formatLakh, formatPaise } from "@/lib/money";
import { getCurrentUser } from "./session";

export interface SettingsData {
  club: {
    name: string; meta: string; deposit: string; rate: string; loanLimit: string;
    term: string; cooldown: string; overdue: string; dividend: string; timezone: string;
  };
  treasury: { name: string; holds: string }[];
  profile: { name: string; phone: string; username: string; email: string; role: string };
  memberOptions: { label: string; value: string }[];
}

export async function getSettingsData(): Promise<SettingsData> {
  const cfg = await prisma.clubConfig.findUnique({ where: { id: "singleton" } });
  const memberCount = await prisma.member.count();
  const stages = (cfg?.stages as { amountPaise: number }[] | undefined) ?? [];
  const deposit = stages.length ? formatPaise(BigInt(stages[stages.length - 1].amountPaise)) : "—";
  const rateSched = (cfg?.rateSchedule as { rateBps: number }[] | undefined) ?? [];
  const rateBps = rateSched.length ? rateSched[rateSched.length - 1].rateBps : 100;

  const treasurers = await prisma.member.findMany({
    where: { treasury: { isNot: null } },
    select: { firstName: true, lastName: true, treasury: { select: { balance: true } } },
    orderBy: { treasury: { balance: "desc" } },
  });

  const user = await getCurrentUser();
  const me = user ? await prisma.member.findUnique({ where: { id: user.id }, select: { phone: true, username: true } }) : null;

  const members = await prisma.member.findMany({ select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: "asc" } });

  return {
    club: {
      name: cfg?.name ?? "Peacock Investment Club",
      meta: `${memberCount} members · started ${cfg ? cfg.startedAt.getUTCFullYear() : ""}`,
      deposit,
      rate: `${rateBps / 100}% / mo`,
      loanLimit: cfg ? formatLakh(cfg.maxLoanPaise) : "—",
      term: `${cfg?.loanTermMonths ?? 5} months`,
      cooldown: `${cfg?.loanCooldownMonths ?? 1} month`,
      overdue: `${(cfg?.overduePenaltyBps ?? 0) / 100}%`,
      dividend: cfg?.dividendEnabled ? "On" : "Off",
      timezone: cfg?.timezone ?? "Asia/Kolkata",
    },
    treasury: treasurers.map((t) => ({ name: [t.firstName, t.lastName].filter(Boolean).join(" "), holds: formatLakh(t.treasury?.balance ?? 0n) })),
    profile: {
      name: user?.name ?? "",
      phone: me?.phone ?? "",
      username: me?.username ?? "",
      email: user?.email ?? "",
      role: user?.role ?? "Member",
    },
    memberOptions: members.map((m) => ({ label: [m.firstName, m.lastName].filter(Boolean).join(" "), value: m.id })),
  };
}
