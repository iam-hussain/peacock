import { redirect } from "next/navigation";
import { TopNav } from "@/features/app-shell/components/top-nav";
import { MobileTopBar, MobileBottomNav } from "@/features/app-shell/components/mobile-nav";
import { AddEntryProvider } from "@/features/entries/add-entry";
import { AdminProvider } from "@/lib/admin";
import { getCurrentUser } from "@/server/queries/session";
import { getEntryPickerOptions } from "@/server/queries/entries";
import { getUnreadCount } from "@/server/queries/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const unread = await getUnreadCount();
  // Kick off picker data but do NOT await it — it must never block page render.
  const optionsPromise = getEntryPickerOptions();
  return (
    <AdminProvider isAdmin={user.isAdmin}>
      <AddEntryProvider optionsPromise={optionsPromise}>
        <div className="min-h-screen bg-bg">
          <TopNav user={user} unread={unread} />
          <MobileTopBar user={user} unread={unread} />
          {children}
          <MobileBottomNav />
        </div>
      </AddEntryProvider>
    </AdminProvider>
  );
}
