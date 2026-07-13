"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  Store,
  BarChart3,
  Sun,
  Settings,
  HelpCircle,
  FileText,
  LogOut,
  ChevronRight,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { toggleTheme } from "@/lib/theme";
import { UserAvatar } from "./user-avatar";
import type { CurrentUser } from "@/server/queries/session";

export function MoreMenu({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const logout = () =>
    signOut({ fetchOptions: { onSuccess: () => router.push("/login") } });
  return (
    <div className="mx-auto flex max-w-140 flex-col gap-4 p-4 pb-19.5">
      {/* profile */}
      <Link href="/settings" className="flex items-center gap-3.5 rounded-2xl border border-bd bg-sf px-4 py-4">
        <UserAvatar initials={user.initials} avatarUrl={user.avatarUrl} className="size-14 bg-teal text-lg font-bold text-white" />
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold leading-tight text-ink">{user.name}</div>
          <div className="mt-1 truncate text-13 font-medium leading-none text-fnt">{user.email}</div>
        </div>
        <span className="text-13 font-semibold leading-none text-teal">Edit</span>
      </Link>

      <MenuCard>
        <Row icon={ArrowLeftRight} label="Transactions" href="/transactions" />
        <Row icon={Store} label="Vendors" href="/vendors" />
        <Row icon={BarChart3} label="Analytics" href="/analytics" />
      </MenuCard>

      {user.isAdmin && (
        <MenuCard>
          <Row icon={ShieldCheck} label="Admin" sub="Auto penalties, audit, members & data" href="/admin" />
        </MenuCard>
      )}

      <MenuCard>
        <ThemeRow />
        <Row icon={Settings} label="Settings" sub="Account, theme, backup & data" href="/settings" />
      </MenuCard>

      <MenuCard>
        <Row icon={HelpCircle} label="How it works" sub="The full club cycle, explained" href="/how-it-works" />
        <Row icon={FileText} label="Terms & conditions" sub="Membership, loans & provisions" href="/terms" />
      </MenuCard>

      <button
        onClick={logout}
        className="flex items-center justify-center gap-2 rounded-2xl border border-bd bg-sf py-4 text-15 font-semibold leading-none text-out"
      >
        <LogOut className="size-3.75" strokeWidth={2} /> Sign out
      </button>
    </div>
  );
}

function MenuCard({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-bd bg-sf">{children}</div>;
}

function Tile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-9 flex-none items-center justify-center rounded-10 bg-tlsf text-teal">
      <Icon className="size-4.5" strokeWidth={2} />
    </span>
  );
}

function Row({ icon, label, sub, href }: { icon: LucideIcon; label: string; sub?: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3.5 border-b border-hr2 px-4 py-4 last:border-b-0 active:bg-bg2">
      <Tile icon={icon} />
      <div className="min-w-0 flex-1">
        <div className="text-15 font-bold leading-none text-ink">{label}</div>
        {sub && <div className="mt-1.5 text-xs font-medium leading-none text-fnt">{sub}</div>}
      </div>
      <ChevronRight className="size-4 flex-none text-fnt" strokeWidth={2} />
    </Link>
  );
}

function ThemeRow() {
  return (
    <button
      onClick={() => toggleTheme()}
      className="flex w-full items-center gap-3.5 border-b border-hr2 px-4 py-4 text-left active:bg-bg2"
    >
      <Tile icon={Sun} />
      <div className="min-w-0 flex-1">
        <div className="text-15 font-bold leading-none text-ink">Theme</div>
        <div className="mt-1.5 text-xs font-medium leading-none text-fnt">Light or dark appearance</div>
      </div>
      <span className="text-15 font-semibold leading-none text-teal">Toggle</span>
    </button>
  );
}
