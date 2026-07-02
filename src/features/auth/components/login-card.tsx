"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ChevronRight, Info } from "lucide-react";
import { initials } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { PeacockLockup } from "@/components/shared/peacock-logo";
import { signIn } from "@/lib/auth-client";
import type { LoginProfile } from "../queries";

export function LoginCard({ profiles }: { profiles: LoginProfile[] }) {
  const [selected, setSelected] = useState<LoginProfile | null>(null);

  return (
    <div className="flex h-dvh w-full flex-col bg-bg px-6 pb-[34px] pt-9 md:h-auto md:min-h-0 md:pb-[26px] md:w-[430px] md:max-w-full md:animate-in md:fade-in md:zoom-in-95 md:rounded-[18px] md:border md:border-bd md:bg-sf md:px-[28px] md:py-[26px] md:shadow-[0_1px_2px_var(--shadow),0_24px_60px_var(--shadow)]">
      <div className="mb-[18px] flex flex-none justify-center border-b border-hair pb-[18px]">
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
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? profiles.filter((p) => p.name.toLowerCase().includes(q)) : profiles;
  }, [query, profiles]);

  return (
    <>
      <h1 className="text-center text-[25px] font-bold leading-[1.1] tracking-[-0.01em] text-ink md:text-[22px]">
        Who&apos;s signing in?
      </h1>
      <p className="mb-4 mt-[7px] text-center text-[13px] font-medium leading-[1.4] text-fnt">
        Tap your name — the club has {profiles.length} profiles.
      </p>

      <div className="mb-3 flex items-center gap-[9px] rounded-[11px] border border-bd2 bg-sf px-3 py-2.5">
        <Search className="size-[15px] flex-none text-fnt" strokeWidth={2} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your name"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-fnt"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto md:h-[360px] md:flex-none">
        {list.map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p)}
            className="flex flex-none items-center gap-3 rounded-xl border border-bd2 bg-sf px-[13px] py-[11px] text-left transition-colors hover:border-mut hover:bg-bg2"
          >
            <LoginAvatar name={p.name} teal={/treasurer|admin/i.test(p.tag)} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold leading-none text-ink">{p.name}</div>
              <div className="mt-1 text-[11px] font-medium leading-[1.3] text-fnt">{p.tag}</div>
            </div>
            <StatusIndicator status={p.status} />
          </button>
        ))}
        {list.length === 0 && (
          <div className="py-8 text-center text-[13px] font-medium text-fnt">No profiles match.</div>
        )}
      </div>

      <Link
        href="/"
        className="mx-auto mt-[18px] flex w-fit items-center justify-center gap-[7px] rounded-[10px] border border-bd2 bg-sf px-[18px] py-[11px] text-[13px] font-semibold text-ink transition-colors hover:border-mut hover:bg-bg2"
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
    return <ChevronRight className="size-[18px] flex-none text-fnt" strokeWidth={2.4} />;
  if (status === "inactive")
    return (
      <span className="flex-none rounded-md bg-wbg px-[7px] py-1 text-[9px] font-bold tracking-[0.05em] text-wfg">
        INACTIVE
      </span>
    );
  return (
    <span className="flex-none rounded-md bg-nbg px-[7px] py-1 text-[9px] font-bold tracking-[0.05em] text-nfg">
      LEFT
    </span>
  );
}

function PasswordStep({ profile, onBack }: { profile: LoginProfile; onBack: () => void }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit() {
    setError(null);
    if (!pw.trim()) {
      setError("Enter your password to continue.");
      return;
    }
    start(async () => {
      const res = await signIn.email({ email: profile.email, password: pw });
      if (res.error) setError(res.error.message ?? "Incorrect password. Try again.");
      else router.push("/dashboard");
    });
  }

  return (
    <>
      <div className="mb-[22px] flex items-center gap-[13px]">
        <LoginAvatar name={profile.name} teal={/treasurer|admin/i.test(profile.tag)} size={48} />
        <div>
          <div className="text-[20px] font-bold leading-[1.1] text-ink md:text-lg">{profile.name}</div>
          <div className="mt-1 text-xs font-medium leading-[1.3] text-fnt">{profile.tag}</div>
        </div>
      </div>

      <label className="mb-2 block text-[11px] font-semibold uppercase leading-none tracking-[0.04em] text-fnt">
        Password
      </label>
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder="Enter your password"
        autoFocus
        className="mb-2.5 w-full rounded-[12px] border border-bd2 bg-sf p-[15px] text-[15px] font-medium text-ink outline-none focus:border-teal md:rounded-[11px] md:p-[13px] md:text-sm"
      />

      <div className="mb-3.5 flex gap-2 rounded-[9px] bg-bg2 px-[11px] py-[9px]">
        <Info className="mt-px size-3.5 flex-none text-mut" strokeWidth={2} />
        <p className="text-[11px] font-medium leading-[1.45] text-mut">
          First time, or just reset? Try your{" "}
          <span className="font-semibold text-ink">registered phone number</span> as the password.
        </p>
      </div>

      {error && (
        <div className="mb-3.5 rounded-lg bg-outbg px-3 py-2.5 text-xs font-medium leading-[1.3] text-outfg">
          {error}
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={pending}
        className="w-full rounded-[13px] bg-teal p-4 text-center text-base font-semibold leading-none text-white disabled:opacity-60 md:rounded-xl md:p-3.5 md:text-[15px]"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <button className="mt-4 block w-full text-center text-xs font-medium leading-none text-teal">
        Forgot password?
      </button>

      <button
        onClick={onBack}
        className="mt-[18px] flex w-full items-center justify-center gap-[7px] rounded-[10px] border border-bd2 bg-sf px-[14px] py-[11px] text-[13px] font-semibold text-ink transition-colors hover:border-mut hover:bg-bg2"
      >
        ← Choose another profile
      </button>
    </>
  );
}
