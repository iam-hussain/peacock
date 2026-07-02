import Link from "next/link";
import { PeacockWordmark } from "@/components/shared/peacock-logo";

export function LandingFooter() {
  return (
    <footer className="border-t border-hair bg-sf">
      <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center gap-4 px-7 py-[22px] sm:gap-5">
        <PeacockWordmark size={16} />
        <span className="text-xs font-medium text-fnt">© 2026 Peacock Club</span>
        <div className="flex-1" />
        <Link href="/how-it-works" className="px-1 py-1.5 text-[13px] font-semibold text-mut hover:text-teal">
          How it works
        </Link>
        <Link href="/terms" className="px-1 py-1.5 text-[13px] font-semibold text-mut hover:text-teal">
          Terms &amp; conditions
        </Link>
      </div>
    </footer>
  );
}
