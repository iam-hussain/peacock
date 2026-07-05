import { QueryProvider } from "@/components/shared/query-provider";
import { AdminProvider } from "@/lib/admin";
import { AddEntryProvider } from "@/features/entries/add-entry";
import { TopNav } from "@/features/app-shell/components/top-nav";
import { MobileTopBar, MobileBottomNav } from "@/features/app-shell/components/mobile-nav";
import { MobileBackHeader } from "@/components/shared/mobile-back-header";
import { PublicHeader } from "./public-header";
import type { CurrentUser } from "@/server/queries/session";

/** Chrome for the public reading pages (How-it-works, Terms): signed-in members keep the real
 *  app bars — same shell as every other page — while visitors get the public header. White
 *  (surface) background: these are long-form reading pages. */
export function PublicShell({
  user,
  title,
  showTerms = true,
  showHowItWorks = false,
  children,
}: {
  user: CurrentUser | null;
  title: string;
  showTerms?: boolean;
  showHowItWorks?: boolean;
  children: React.ReactNode;
}) {
  if (!user) {
    return (
      <div className="min-h-screen bg-sf">
        <div className="hidden md:block">
          <PublicHeader showTerms={showTerms} showHowItWorks={showHowItWorks} />
        </div>
        <div className="md:hidden">
          <MobileBackHeader title={title} backHref="/" />
        </div>
        {children}
      </div>
    );
  }
  return (
    <AdminProvider isAdmin={user.isAdmin}>
      <QueryProvider>
        <AddEntryProvider>
          <div className="min-h-screen bg-sf pb-16 md:pb-0">
            <TopNav user={user} />
            <MobileTopBar user={user} />
            {children}
            <MobileBottomNav />
          </div>
        </AddEntryProvider>
      </QueryProvider>
    </AdminProvider>
  );
}
