"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Upload, Sun, Plus } from "lucide-react";
import { BrandLockup } from "@/components/shared/brand-lockup";
import { NAV } from "../nav";
import { UserMenu } from "./user-menu";
import { useAddEntry } from "@/features/entries/add-entry";
import { toggleTheme } from "@/lib/theme";
import type { CurrentUser } from "@/server/queries/session";

/** Desktop top navigation bar. */
export function TopNav({ user, unread = 0 }: { user: CurrentUser; unread?: number }) {
  const pathname = usePathname();
  const addEntry = useAddEntry();
  return (
    <header className="sticky top-0 z-30 hidden items-center gap-3.5 border-b border-hair bg-sf px-6.5 py-3.25 md:flex">
      <BrandLockup href="/dashboard" markPx={42} wordSize={19} />

      <nav className="ml-4 flex gap-0.5">
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + "/");
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-lg px-3.25 py-2 text-13 font-semibold leading-none transition-colors ${
                active ? "bg-tlsf text-teal" : "text-mut hover:bg-bg2"
              }`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <Link
        href="/notifications"
        aria-label="Notifications"
        className="relative flex size-8.5 items-center justify-center rounded-9 border border-bd text-mut hover:bg-bg2"
      >
        <Bell className="size-4.25" strokeWidth={2} />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-9 border-2 border-sf bg-out px-1 font-mono text-9 font-bold text-white">
            {unread}
          </span>
        )}
      </Link>

      <Link
        href="/share"
        aria-label="Share"
        className="flex size-8.5 items-center justify-center rounded-9 border border-bd text-mut hover:bg-bg2"
      >
        <Upload className="size-4.25" strokeWidth={2} />
      </Link>

      <ThemeToggle />

      <button
        onClick={() => addEntry.open()}
        className="flex items-center gap-1 rounded-9 bg-teal px-4 py-2.5 text-13 font-semibold leading-none text-white"
      >
        <Plus className="size-4" strokeWidth={2.5} /> Add entry
      </button>

      <UserMenu user={user} />
    </header>
  );
}

function ThemeToggle() {
  return (
    <button
      aria-label="Toggle theme"
      onClick={() => toggleTheme()}
      className="flex size-8.5 items-center justify-center rounded-9 border border-bd text-mut hover:bg-bg2"
    >
      <Sun className="size-4.25" strokeWidth={2} />
    </button>
  );
}
