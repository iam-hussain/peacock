import { Terms } from "@/features/marketing/components/terms";
import { PublicShell } from "@/features/marketing/components/public-shell";
import { getCurrentUser } from "@/server/queries/session";

export default async function TermsPage() {
  const user = await getCurrentUser();
  return (
    <PublicShell user={user} title="Terms & conditions" showTerms={false} showHowItWorks>
      <Terms />
    </PublicShell>
  );
}
