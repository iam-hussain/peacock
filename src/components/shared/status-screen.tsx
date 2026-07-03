import Link from "next/link";
import { BrandLockup } from "./brand-lockup";

/** Full-screen centered message (404 / error). Actions passed as children. */
export function StatusScreen({
  code,
  title,
  message,
  children,
}: {
  code: string;
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 py-12 text-center">
      <BrandLockup href="/dashboard" className="mb-10" />
      <div className="font-display text-[64px] font-extrabold leading-none tracking-[-0.04em] text-teal md:text-[80px]">
        {code}
      </div>
      <h1 className="mt-5 text-xl font-bold leading-tight tracking-[-0.02em] text-ink md:text-2xl">{title}</h1>
      <p className="mt-2.5 max-w-[340px] text-sm font-medium leading-[1.5] text-fnt">{message}</p>
      {children && <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{children}</div>}
    </div>
  );
}

/** Primary teal CTA, matches the app's button treatment. */
export function StatusPrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-[13px] bg-teal px-5 py-3 text-[15px] font-semibold leading-none text-white transition-opacity hover:opacity-90"
    >
      {children}
    </Link>
  );
}
