import { redirect } from "next/navigation";
import { QueryProvider } from "@/components/shared/query-provider";
import { TopNav } from "@/features/app-shell/components/top-nav";
import { MobileTopBar, MobileBottomNav } from "@/features/app-shell/components/mobile-nav";
import { AddEntryProvider } from "@/features/entries/add-entry";
import { AdminProvider } from "@/lib/admin";
import { getCurrentUser } from "@/server/queries/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The only server read in the shell (cookie-cached): who is signed in. Everything else —
  // unread badge, entry-picker options, page data — loads client-side through React Query.
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <AdminProvider isAdmin={user.isAdmin}>
      <QueryProvider>
        <AddEntryProvider>
          <div className="min-h-screen bg-bg">
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
