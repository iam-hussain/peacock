"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, HelpCircle, FileText, LogOut, ChevronDown } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import type { CurrentUser } from "@/server/queries/session";

export function UserMenu({ user }: { user: CurrentUser }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const logout = () =>
    signOut({ fetchOptions: { onSuccess: () => router.push("/login") } });
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-[7px] rounded-[20px] border py-[3px] pl-[3px] pr-[7px] transition-colors ${
          open ? "border-bd2 bg-bg2" : "border-transparent hover:bg-bg2"
        }`}
      >
        <span className="flex size-[30px] items-center justify-center rounded-full bg-teal text-xs font-bold text-white">
          {user.initials}
        </span>
        <ChevronDown className={`size-3.5 text-mut transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="absolute right-0 top-[46px] z-[41] w-[248px] overflow-hidden rounded-[14px] border border-bd bg-sf shadow-[0_1px_2px_var(--shadow),0_18px_44px_var(--shadow)]">
            <div className="flex items-center gap-[11px] border-b border-hair px-4 py-[15px]">
              <span className="flex size-[38px] items-center justify-center rounded-full bg-teal text-sm font-bold text-white">
                {user.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold leading-none text-ink">{user.name}</div>
                <div className="mt-1 truncate font-mono text-[11px] font-medium leading-[1.3] text-fnt">
                  {user.email}
                </div>
              </div>
            </div>
            <div className="p-1.5">
              <MenuLink href="/settings" icon={Settings} label="Account & settings" />
              <MenuLink href="/how-it-works" icon={HelpCircle} label="How it works" />
              <MenuLink href="/terms" icon={FileText} label="Terms & conditions" />
            </div>
            <div className="border-t border-hair p-1.5">
              <button
                onClick={logout}
                className="flex w-full items-center gap-[11px] rounded-[9px] px-[11px] py-2.5 text-left text-[13px] font-semibold text-out hover:bg-outbg"
              >
                <LogOut className="size-4" strokeWidth={2} />
                Log out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MenuLink({ href, icon: Icon, label }: { href: string; icon: typeof Settings; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-[11px] rounded-[9px] px-[11px] py-2.5 text-[13px] font-semibold text-ink hover:bg-bg2"
    >
      <Icon className="size-4 text-mut" strokeWidth={2} />
      {label}
    </Link>
  );
}
