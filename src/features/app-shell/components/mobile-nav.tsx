"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Upload, LayoutDashboard, Users, HandCoins, LayoutGrid, Plus, type LucideIcon } from "lucide-react";
import { BrandLockup } from "@/components/shared/brand-lockup";
import { NAV } from "../nav";
import { useAddEntry } from "@/features/entries/add-entry";
import { UserAvatar } from "./user-avatar";
import type { CurrentUser } from "@/server/queries/session";

const EXTRA_TITLES: Record<string, string> = {
  "/more": "More",
  "/notifications": "Notifications",
  "/share": "Share",
  "/audit": "Audit log",
};

function sectionTitle(pathname: string): string | null {
  if (pathname === "/dashboard") return null;
  for (const [href, label] of Object.entries(EXTRA_TITLES)) {
    if (pathname.startsWith(href)) return label;
  }
  const match = NAV.find((n) => n.href !== "/dashboard" && pathname.startsWith(n.href));
  return match?.label ?? null;
}

/** Mobile top bar: brand + section title + share / notifications / avatar. */
export function MobileTopBar({ user, unread = 0 }: { user: CurrentUser; unread?: number }) {
  const pathname = usePathname();
  const title = sectionTitle(pathname);
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-hair bg-sf px-4 py-[15px] md:hidden">
      <BrandLockup href="/dashboard" markPx={42} wordSize={19} />
      {title && (
        <>
          <span className="h-[15px] w-px flex-none bg-bd" />
          <span className="min-w-0 truncate text-sm font-semibold text-mut">{title}</span>
        </>
      )}
      <div className="flex-1" />
      <Link
        href="/share"
        aria-label="Share"
        className="flex size-[34px] flex-none items-center justify-center rounded-full border border-bd text-mut"
      >
        <Upload className="size-4" strokeWidth={2} />
      </Link>
      <Link
        href="/notifications"
        aria-label="Notifications"
        className="relative flex size-[34px] flex-none items-center justify-center rounded-full border border-bd text-mut"
      >
        <Bell className="size-4" strokeWidth={2} />
        {unread > 0 && (
          <span className="absolute -right-[3px] -top-[3px] flex h-4 min-w-4 items-center justify-center rounded-lg border-2 border-sf bg-out px-[3px] font-mono text-[9px] font-bold text-white">
            {unread}
          </span>
        )}
      </Link>
      <UserAvatar initials={user.initials} avatarUrl={user.avatarUrl} className="size-[34px] bg-nbg text-xs font-bold text-nfg" />
    </header>
  );
}

const LEFT_TABS = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Members", href: "/members", icon: Users },
];
const RIGHT_TABS = [
  { label: "Loans", href: "/loans", icon: HandCoins },
  { label: "More", href: "/more", icon: LayoutGrid },
];

/** Fixed mobile bottom navigation with a raised center "+ Add entry" FAB. */
export function MobileBottomNav() {
  const pathname = usePathname();
  const addEntry = useAddEntry();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex items-stretch border-t border-hair bg-sf pb-[env(safe-area-inset-bottom)] md:hidden">
      {LEFT_TABS.map((n) => (
        <Tab key={n.href} {...n} active={isActive(n.href)} />
      ))}
      <div className="flex flex-1 items-start justify-center">
        <button
          aria-label="Add entry"
          onClick={() => addEntry.open()}
          className="-mt-5 flex size-[52px] items-center justify-center rounded-full bg-teal text-white shadow-[0_8px_18px_rgba(14,140,130,0.35)] ring-4 ring-sf"
        >
          <Plus className="size-6" strokeWidth={2.5} />
        </button>
      </div>
      {RIGHT_TABS.map((n) => (
        <Tab key={n.href} {...n} active={isActive(n.href)} />
      ))}
    </nav>
  );
}

function Tab({ label, href, icon: Icon, active }: { label: string; href: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link href={href} className={`flex flex-1 flex-col items-center gap-1 py-2.5 ${active ? "text-teal" : "text-mut"}`}>
      <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
      <span className="text-[10px] font-semibold leading-none">{label}</span>
    </Link>
  );
}
