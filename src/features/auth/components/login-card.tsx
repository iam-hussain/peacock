"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ChevronRight, Info, Eye, EyeOff } from "lucide-react";
import { initials } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { PeacockLockup } from "@/components/shared/peacock-logo";
import { signIn } from "@/lib/auth-client";
import type { LoginProfile } from "../queries";

const LAST_PROFILE_KEY = "peacock:lastProfileId";

export function LoginCard({ profiles }: { profiles: LoginProfile[] }) {
  const [selected, setSelected] = useState<LoginProfile | null>(null);

  return (
    <div className="flex h-dvh w-full flex-col bg-bg px-6 pb-8.5 pt-9 md:h-auto md:min-h-0 md:pb-6.5 md:w-[430px] md:max-w-full md:animate-in md:fade-in md:zoom-in-95 md:rounded-18 md:border md:border-bd md:bg-sf md:px-[28px] md:py-6.5 md:shadow-pop">
      <div className="mb-4.5 flex flex-none justify-center border-b border-hair pb-4.5">
        <div style={{ zoom: 0.78 }}>
          <PeacockLockup markPx={80} wordSize={32} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {selected ? (
          <PasswordStep profile={selected} onBack={() => setSelected(null)} />
        ) : (
          <PickStep profiles={profiles} onPick={setSelected} />
        )}
      </div>
    </div>
  );
}

function PickStep({ profiles, onPick }: { profiles: LoginProfile[]; onPick: (p: LoginProfile) => void }) {
  const [query, setQuery] = useState("");
  const [lastId, setLastId] = useState<string | null>(null);

  useEffect(() => {
    // Read localStorage post-mount, not in a lazy initializer: the server renders `null`, so
    // reading it during render would cause a hydration mismatch. This effect is the SSR-safe pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastId(localStorage.getItem(LAST_PROFILE_KEY));
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? profiles.filter((p) => p.name.toLowerCase().includes(q)) : profiles;
    if (!lastId) return filtered;
    // float the last-used profile to the top (server order otherwise: most-recent login first)
    const idx = filtered.findIndex((p) => p.id === lastId);
    if (idx <= 0) return filtered;
    return [filtered[idx], ...filtered.slice(0, idx), ...filtered.slice(idx + 1)];
  }, [query, profiles, lastId]);

  return (
    <>
      <h1 className="text-center text-25 font-bold leading-110 tracking-[-0.01em] text-ink md:text-22">
        Who&apos;s signing in?
      </h1>
      <p className="mb-4 mt-1.75 text-center text-13 font-medium leading-140 text-fnt">
        Tap your name — the club has {profiles.length} profiles.
      </p>

      <div className="mb-3 flex items-center gap-2.25 rounded-11 border border-bd2 bg-sf px-3 py-2.5">
        <Search className="size-3.75 flex-none text-fnt" strokeWidth={2} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your name"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-fnt"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto md:h-90 md:flex-none">
        {list.map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p)}
            className="flex flex-none items-center gap-3 rounded-xl border border-bd2 bg-sf px-3.25 py-2.75 text-left transition-colors hover:border-mut hover:bg-bg2"
          >
            <LoginAvatar name={p.name} teal={/treasurer|admin/i.test(p.tag)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold leading-none text-ink">{p.name}</span>
                {p.id === lastId && (
                  <span className="rounded-md bg-nbg px-1.5 py-0.75 text-9 font-bold leading-none tracking-5 text-nfg">
                    LAST USED
                  </span>
                )}
              </div>
              <div className="mt-1 text-11 font-medium leading-130 text-fnt">{p.tag}</div>
            </div>
            <StatusIndicator status={p.status} />
          </button>
        ))}
        {list.length === 0 && (
          <div className="py-8 text-center text-13 font-medium text-fnt">No profiles match.</div>
        )}
      </div>

      <Link
        href="/"
        className="mx-auto mt-4.5 flex w-fit items-center justify-center gap-1.75 rounded-10 border border-bd2 bg-sf px-4.5 py-2.75 text-13 font-semibold text-ink transition-colors hover:border-mut hover:bg-bg2"
      >
        ← Back to home
      </Link>
    </>
  );
}

function LoginAvatar({ name, teal, size = 38 }: { name: string; teal: boolean; size?: number }) {
  return (
    <div
      className={cn(
        "flex flex-none items-center justify-center rounded-full font-bold",
        teal ? "bg-teal text-white" : "bg-nbg text-nfg",
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {initials(name)}
    </div>
  );
}

function StatusIndicator({ status }: { status: LoginProfile["status"] }) {
  if (status === "active")
    return <ChevronRight className="size-4.5 flex-none text-fnt" strokeWidth={2.4} />;
  if (status === "inactive")
    return (
      <span className="flex-none rounded-md bg-wbg px-1.75 py-1 text-9 font-bold tracking-5 text-wfg">
        INACTIVE
      </span>
    );
  return (
    <span className="flex-none rounded-md bg-nbg px-1.75 py-1 text-9 font-bold tracking-5 text-nfg">
      LEFT
    </span>
  );
}

function PasswordStep({ profile, onBack }: { profile: LoginProfile; onBack: () => void }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit() {
    setError(null);
    if (!pw.trim()) {
      setError("Enter your password to continue.");
      return;
    }
    start(async () => {
      // Stored default password is the full phone incl. +91. If a bare 10-digit number
      // fails, retry once with +91 prepended so both forms work (see hint below).
      const attempts = /^\d{10}$/.test(pw.trim()) ? [pw, `+91${pw.trim()}`] : [pw];
      for (const password of attempts) {
        const res = await signIn.email({ email: profile.email, password, rememberMe: remember });
        if (!res.error) {
          localStorage.setItem(LAST_PROFILE_KEY, profile.id);
          router.push("/dashboard");
          return;
        }
        setError(res.error.message ?? "Incorrect password. Try again.");
      }
    });
  }

  return (
    <>
      <div className="mb-5.5 flex items-center gap-3.25">
        <LoginAvatar name={profile.name} teal={/treasurer|admin/i.test(profile.tag)} size={48} />
        <div>
          <div className="text-[20px] font-bold leading-110 text-ink md:text-lg">{profile.name}</div>
          <div className="mt-1 text-xs font-medium leading-130 text-fnt">{profile.tag}</div>
        </div>
      </div>

      <label className="mb-2 block text-11 font-semibold uppercase leading-none tracking-4 text-fnt">
        Password
      </label>
      <div className="relative mb-2.5">
        <input
          type={show ? "text" : "password"}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="Enter your password"
          autoFocus
          className="w-full rounded-12 border border-bd2 bg-sf p-3.75 pr-11 text-15 font-medium text-ink outline-none focus:border-teal md:rounded-11 md:p-3.25 md:pr-11 md:text-sm"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex items-center px-3.5 text-fnt transition-colors hover:text-ink"
        >
          {show ? <EyeOff className="size-4.5" strokeWidth={2} /> : <Eye className="size-4.5" strokeWidth={2} />}
        </button>
      </div>

      <label className="mb-2.5 flex cursor-pointer select-none items-center gap-2 text-13 font-medium text-fnt">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="size-4 accent-teal"
        />
        Remember me on this device
      </label>

      <div className="mb-3.5 flex gap-2 rounded-9 bg-bg2 px-2.75 py-2.25">
        <Info className="mt-px size-3.5 flex-none text-mut" strokeWidth={2} />
        <p className="text-11 font-medium leading-145 text-mut">
          First time, or just reset? Try your{" "}
          <span className="font-semibold text-ink">registered phone number</span> as the password —
          with or without <span className="font-semibold text-ink">+91</span> (e.g.{" "}
          <span className="font-semibold text-ink">+919876543210</span> or{" "}
          <span className="font-semibold text-ink">9876543210</span>).
        </p>
      </div>

      {error && (
        <div className="mb-3.5 rounded-lg bg-outbg px-3 py-2.5 text-xs font-medium leading-130 text-outfg">
          {error}
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={pending}
        className="w-full rounded-13 bg-teal p-4 text-center text-base font-semibold leading-none text-white disabled:opacity-60 md:rounded-xl md:p-3.5 md:text-15"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <button
        onClick={onBack}
        className="mt-4.5 flex w-full items-center justify-center gap-1.75 rounded-10 border border-bd2 bg-sf px-[14px] py-2.75 text-13 font-semibold text-ink transition-colors hover:border-mut hover:bg-bg2"
      >
        ← Choose another profile
      </button>
    </>
  );
}
