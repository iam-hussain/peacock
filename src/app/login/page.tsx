import { LoginCard } from "@/features/auth/components/login-card";
import { getLoginProfiles } from "@/features/auth/queries";

export default async function LoginPage() {
  const profiles = await getLoginProfiles();
  return (
    <div className="min-h-screen bg-bg md:flex md:items-center md:justify-center md:p-7">
      <LoginCard profiles={profiles} />
    </div>
  );
}
