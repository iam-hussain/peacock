import { redirect } from "next/navigation";
import { TopNav } from "@/features/app-shell/components/top-nav";
import { MobileTopBar, MobileBottomNav } from "@/features/app-shell/components/mobile-nav";
import { AddEntryProvider } from "@/features/entries/add-entry";
import { getCurrentUser } from "@/server/queries/session";
import { getEntryPickerOptions } from "@/server/queries/entries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Kick off picker data but do NOT await it — it must never block page render.
  const optionsPromise = getEntryPickerOptions();
  return (
    <AddEntryProvider optionsPromise={optionsPromise}>
      <div className="min-h-screen bg-bg">
        <TopNav user={user} />
        <MobileTopBar user={user} />
        {children}
        <MobileBottomNav />
      </div>
    </AddEntryProvider>
  );
}
