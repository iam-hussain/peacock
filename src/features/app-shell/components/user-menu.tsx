"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, HelpCircle, FileText, LogOut, ChevronDown, MessageCircle } from "lucide-react";
import { WHATSAPP_CHAT_LINK } from "@/components/shared/whatsapp-card";
import { signOut } from "@/lib/auth-client";
import { UserAvatar } from "./user-avatar";
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
        className={`flex items-center gap-1.75 rounded-20 border py-0.75 pl-0.75 pr-1.75 transition-colors ${
          open ? "border-bd2 bg-bg2" : "border-transparent hover:bg-bg2"
        }`}
      >
        <UserAvatar initials={user.initials} avatarUrl={user.avatarUrl} className="size-7.5 bg-teal text-xs font-bold text-white" />
        <ChevronDown className={`size-3.5 text-mut transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="absolute right-0 top-11.5 z-[41] w-[248px] overflow-hidden rounded-14 border border-bd bg-sf shadow-[0_1px_2px_var(--shadow),0_18px_44px_var(--shadow)]">
            <div className="flex items-center gap-2.75 border-b border-hair px-4 py-3.75">
              <UserAvatar initials={user.initials} avatarUrl={user.avatarUrl} className="size-9.5 bg-teal text-sm font-bold text-white" />
              <div className="min-w-0 flex-1">
                <div className="text-13 font-bold leading-none text-ink">{user.name}</div>
                <div className="mt-1 truncate font-mono text-11 font-medium leading-130 text-fnt">
                  {user.email}
                </div>
              </div>
            </div>
            <div className="p-1.5">
              <MenuLink href="/settings" icon={Settings} label="Account & settings" />
              <a
                href={WHATSAPP_CHAT_LINK}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.75 rounded-9 px-2.75 py-2.5 text-13 font-semibold text-ink hover:bg-bg2"
              >
                <MessageCircle className="size-4 text-mut" strokeWidth={2} />
                WhatsApp bot
              </a>
              <MenuLink href="/how-it-works" icon={HelpCircle} label="How it works" />
              <MenuLink href="/terms" icon={FileText} label="Terms & conditions" />
            </div>
            <div className="border-t border-hair p-1.5">
              <button
                onClick={logout}
                className="flex w-full items-center gap-2.75 rounded-9 px-2.75 py-2.5 text-left text-13 font-semibold text-out hover:bg-outbg"
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
      className="flex items-center gap-2.75 rounded-9 px-2.75 py-2.5 text-13 font-semibold text-ink hover:bg-bg2"
    >
      <Icon className="size-4 text-mut" strokeWidth={2} />
      {label}
    </Link>
  );
}
