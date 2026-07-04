"use client";

import { LogOut, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { initials } from "@/lib/avatar";
import { useTheme } from "@/lib/theme";
import { FormModalButton } from "@/components/shared/form-modal-button";
import { AvatarEditButton } from "./avatar-editor";
import { Card, FieldRow } from "./settings-primitives";
import type { SettingsData } from "@/server/queries/settings";

const CHANGE_PW_FIELDS = [
  { name: "current", label: "Current password", type: "password" as const, required: true },
  { name: "new", label: "New password", type: "password" as const, required: true },
  { name: "confirm", label: "Confirm new password", type: "password" as const, required: true },
];

function EditProfileButton({
  profile,
  className,
  ariaLabel,
  children,
}: {
  profile: SettingsData["profile"];
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <FormModalButton
      title="Edit profile"
      subtitle="Update your details."
      kind="editProfile"
      submitLabel="Save changes"
      buttonClassName={className}
      buttonAriaLabel={ariaLabel}
      fields={[
        { name: "name", label: "Full name", defaultValue: profile.name, required: true },
        { name: "email", label: "Email", type: "email", defaultValue: profile.email },
        { name: "phone", label: "Phone", type: "tel", defaultValue: profile.phone, required: true },
        { name: "username", label: "Username", defaultValue: profile.username },
      ]}
    >
      {children}
    </FormModalButton>
  );
}

export function ProfileTab({ profile }: { profile: SettingsData["profile"] }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center gap-3.5 border-b border-hr2 px-5 py-4.5">
          <span className="relative flex size-13 flex-none items-center justify-center rounded-full bg-teal text-lg font-bold text-white">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external avatar URL, no image domain config
              <img src={profile.avatarUrl} alt="" className="size-full rounded-full object-cover" />
            ) : (
              initials(profile.name)
            )}
            <AvatarEditButton
              hasAvatar={!!profile.avatarUrl}
              className="absolute -bottom-0.5 -right-0.5 flex size-5.5 items-center justify-center rounded-full border-2 border-sf bg-teal text-white"
            />
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold leading-none text-ink">{profile.name}</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-tlsf px-1.75 py-1 text-9 font-bold uppercase leading-none tracking-5 text-teal">
                <Shield className="size-2.5" strokeWidth={2.4} /> {profile.role}
              </span>
            </div>
            <div className="mt-1.5 text-xs font-medium leading-none text-fnt">
              {[profile.isTreasurer && "Treasurer", profile.role].filter(Boolean).join(" · ")}
            </div>
          </div>
          <EditProfileButton profile={profile} className="text-xs font-semibold leading-none text-teal">
            Change
          </EditProfileButton>
        </div>
        <FieldRow label="Full name" value={profile.name} mono={false} />
        <FieldRow label="Email" value={profile.email} />
        <FieldRow label="Phone" value={profile.phone} />
        <FieldRow label="Username" value={profile.username} />
        <div className="flex items-center justify-between px-5 py-3.5">
          <div>
            <div className="text-13 font-medium leading-none text-mut">Password</div>
            <div className="mt-1.5 font-mono text-13 font-semibold tracking-12 text-ink">••••••••</div>
          </div>
          <FormModalButton
            title="Change password"
            kind="changePassword"
            submitLabel="Update password"
            fields={CHANGE_PW_FIELDS}
            buttonClassName="rounded-lg border border-bd2 px-3 py-2 text-xs font-semibold leading-none text-teal"
          >
            Change password
          </FormModalButton>
        </div>
      </Card>

      <Card>
        <div className="border-b border-hair px-5 py-4 text-12 font-bold uppercase leading-none tracking-6 text-teal">
          Appearance
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <div className="text-sm font-bold leading-none text-ink">Theme</div>
            <div className="mt-1 text-xs font-medium leading-none text-fnt">Light or dark interface</div>
          </div>
          <ThemeToggle />
        </div>
      </Card>

      <SignOutButton />
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  return (
    <div className="flex gap-0.75 rounded-9 bg-bg2 p-0.75">
      {(["light", "dark"] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTheme(t)}
          aria-pressed={theme === t}
          className={`rounded-7 px-3.5 py-2 text-xs font-semibold capitalize leading-none transition-colors ${
            theme === t ? "bg-sf text-ink shadow-sm" : "text-mut hover:text-ink"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => signOut({ fetchOptions: { onSuccess: () => router.push("/login") } })}
      className="flex items-center justify-center gap-2 rounded-14 border border-bd bg-sf px-5 py-4 text-sm font-semibold leading-none text-out hover:bg-outbg"
    >
      <LogOut className="size-3.75" strokeWidth={2} /> Sign out
    </button>
  );
}
