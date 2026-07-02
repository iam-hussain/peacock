import Link from "next/link";
import { BrandLockup } from "@/components/shared/brand-lockup";

export function LandingHeader() {
  return (
    <header className="mx-auto flex w-full max-w-[1180px] items-center gap-[11px] px-7 py-5">
      <BrandLockup markPx={42} wordSize={21} />
      <div className="flex-1" />
      <Link
        href="/login"
        className="px-3 py-2 text-[13px] font-semibold leading-none text-mut transition-colors hover:text-teal"
      >
        Sign in
      </Link>
      <Link
        href="/login"
        className="rounded-[9px] bg-teal px-4 py-2.5 text-[13px] font-semibold leading-none text-white"
      >
        Open club
      </Link>
    </header>
  );
}
