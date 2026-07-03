"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Upload, Sun, Plus } from "lucide-react";
import { BrandLockup } from "@/components/shared/brand-lockup";
import { NAV } from "../nav";
import { UserMenu } from "./user-menu";
import { useAddEntry } from "@/features/entries/add-entry";
import type { CurrentUser } from "@/server/queries/session";

/** Desktop top navigation bar. */
export function TopNav({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const addEntry = useAddEntry();
  return (
    <header className="sticky top-0 z-30 hidden items-center gap-3.5 border-b border-hair bg-sf px-[26px] py-[13px] md:flex">
      <BrandLockup href="/dashboard" markPx={42} wordSize={19} />

      <nav className="ml-4 flex gap-0.5">
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + "/");
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-lg px-[13px] py-2 text-[13px] font-semibold leading-none transition-colors ${
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
        className="relative flex size-[34px] items-center justify-center rounded-[9px] border border-bd text-mut hover:bg-bg2"
      >
        <Bell className="size-[17px]" strokeWidth={2} />
        <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] border-2 border-sf bg-out px-1 font-mono text-[9px] font-bold text-white">
          3
        </span>
      </Link>

      <Link
        href="/share"
        aria-label="Share"
        className="flex size-[34px] items-center justify-center rounded-[9px] border border-bd text-mut hover:bg-bg2"
      >
        <Upload className="size-[17px]" strokeWidth={2} />
      </Link>

      <ThemeToggle />

      <button
        onClick={() => addEntry.open()}
        className="flex items-center gap-1 rounded-[9px] bg-teal px-4 py-2.5 text-[13px] font-semibold leading-none text-white"
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
      onClick={() => document.documentElement.classList.toggle("dark")}
      className="flex size-[34px] items-center justify-center rounded-[9px] border border-bd text-mut hover:bg-bg2"
    >
      <Sun className="size-[17px]" strokeWidth={2} />
    </button>
  );
}
