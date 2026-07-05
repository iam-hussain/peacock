import Link from "next/link";
import { BrandLockup } from "@/components/shared/brand-lockup";

/** Desktop sticky header for public standalone pages (How-it-works, Terms). */
export function PublicHeader({
  showTerms = true,
  showHowItWorks = false,
}: {
  showTerms?: boolean;
  showHowItWorks?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2.75 border-b border-hair bg-sf px-6.5 py-4">
      <BrandLockup href="/" markPx={42} wordSize={21} />
      <div className="flex-1" />
      {showHowItWorks && (
        <Link href="/how-it-works" className="px-3 py-2 text-13 font-semibold leading-none text-mut hover:text-teal">
          How it works
        </Link>
      )}
      {showTerms && (
        <Link href="/terms" className="px-3 py-2 text-13 font-semibold leading-none text-mut hover:text-teal">
          Terms &amp; conditions
        </Link>
      )}
      <Link href="/" className="px-3 py-2 text-13 font-semibold leading-none text-mut hover:text-teal">
        ← Home
      </Link>
      <Link
        href="/login"
        className="rounded-9 bg-teal px-4 py-2.5 text-13 font-semibold leading-none text-white"
      >
        Sign in
      </Link>
    </header>
  );
}
