import { redirect } from "next/navigation";
import { TopNav } from "@/features/app-shell/components/top-nav";
import { MobileTopBar, MobileBottomNav } from "@/features/app-shell/components/mobile-nav";
import { AddEntryProvider } from "@/features/entries/add-entry";
import { getCurrentUser } from "@/server/queries/session";
import { getEntryPickerOptions } from "@/server/queries/entries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, options] = await Promise.all([getCurrentUser(), getEntryPickerOptions()]);
  if (!user) redirect("/login");
  return (
    <AddEntryProvider options={options}>
      <div className="min-h-screen bg-bg">
        <TopNav user={user} />
        <MobileTopBar user={user} />
        {children}
        <MobileBottomNav />
      </div>
    </AddEntryProvider>
  );
}
