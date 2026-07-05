import { HowItWorks } from "@/features/marketing/components/how-it-works";
import { PublicShell } from "@/features/marketing/components/public-shell";
import { getCurrentUser } from "@/server/queries/session";

export default async function HowItWorksPage() {
  const user = await getCurrentUser();
  return (
    <PublicShell user={user} title="How it works">
      <HowItWorks signedIn={!!user} />
    </PublicShell>
  );
}
