import Link from "next/link";
import { PeacockLockup } from "@/components/shared/peacock-logo";
import { WhatsAppCard } from "@/components/shared/whatsapp-card";
import { PortfolioPreview } from "./portfolio-preview";

const STATS = [
  { value: "48", label: "members", accent: false },
  { value: "₹48.2L", label: "managed", accent: false },
  { value: "14.5%", label: "avg. ROI", accent: true },
];

/** Landing — mobile layout (matches the design's mobile section; single scroll column). */
export function LandingMobile() {
  return (
    <div className="flex min-h-screen flex-col bg-bg md:hidden">
      <div className="px-5 pb-1.5 pt-8 text-center">
        <div className="mb-4.5 flex justify-center">
          <PeacockLockup markPx={64} wordSize={32} />
        </div>
        <h1 className="font-display text-26 font-extrabold leading-112 tracking-[-0.025em] text-ink">
          Every rupee your club holds, in plain sight.
        </h1>
        <p className="mt-3 text-sm font-medium leading-150 text-mut">
          Deposits, loans, interest and vendor returns — recorded in seconds, transparent to every
          member.
        </p>
      </div>

      <div className="px-5">
        <PortfolioPreview compact />
      </div>

      <div className="px-5 py-5">
        <Link
          href="/login"
          className="block rounded-13 bg-teal p-3.75 text-center text-15 font-semibold text-white"
        >
          Sign in to your club
        </Link>
        <Link
          href="/how-it-works"
          className="mt-2.5 block rounded-13 border border-bd2 p-3.75 text-center text-15 font-semibold text-ink"
        >
          See how it works
        </Link>

        <div className="mt-5.5 flex justify-around">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className={`font-mono text-lg font-semibold ${s.accent ? "text-teal" : "text-ink"}`}>
                {s.value}
              </div>
              <div className="mt-1.25 text-11 font-medium leading-130 text-fnt">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <WhatsAppCard />
        </div>

        <div className="mt-6 flex items-center justify-center gap-3.5 border-t border-hair pt-4.5">
          <Link href="/how-it-works" className="text-xs font-semibold text-mut">
            How it works
          </Link>
          <span className="size-0.75 rounded-full bg-bd2" />
          <Link href="/terms" className="text-xs font-semibold text-mut">
            Terms &amp; conditions
          </Link>
        </div>
        <div className="mt-3 text-center text-11 font-medium text-fnt">© 2026 Peacock Club</div>
      </div>
    </div>
  );
}
