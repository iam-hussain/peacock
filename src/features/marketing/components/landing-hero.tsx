import Link from "next/link";
import { PeacockLockup } from "@/components/shared/peacock-logo";
import { PortfolioPreview } from "./portfolio-preview";

const STATS = [
  { value: "₹48.2L", label: "under management", accent: false },
  { value: "48", label: "members", accent: false },
  { value: "14.5%", label: "avg. vendor ROI", accent: true },
];

export function LandingHero() {
  return (
    <section className="flex flex-1 items-center justify-center px-7 pb-16 pt-8">
      <div className="grid w-full max-w-[1100px] items-center gap-12 grid-cols-[1.05fr_0.95fr]">
        {/* copy — centered column, matching the design */}
        <div className="flex animate-in fade-in slide-in-from-bottom-2 flex-col items-center text-center">
          {/* margin stays outside the zoom (the design nests zoom inside the mb-24 wrapper) */}
          <div className="mb-6">
            <div style={{ zoom: 1.6 }}>
              <PeacockLockup markPx={80} wordSize={32} />
            </div>
          </div>

          <h1 className="max-w-[480px] font-display text-[30px] font-extrabold leading-[1.12] tracking-[-0.025em] text-ink">
            Every rupee your club holds, in plain sight.
          </h1>
          <p className="mt-[13px] max-w-[460px] text-[15px] font-medium leading-[1.55] text-mut">
            Deposits, loans, interest and vendor returns — recorded in seconds, transparent to every
            member.
          </p>

          <div className="mt-[30px] flex gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-teal px-[26px] py-[15px] text-[15px] font-semibold leading-none text-white"
            >
              Sign in to your club
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-xl border border-bd2 px-6 py-[15px] text-[15px] font-semibold leading-none text-ink"
            >
              See how it works
            </Link>
          </div>

          <div className="mt-[38px] flex items-stretch gap-[26px]">
            {STATS.map((s, i) => (
              <div key={s.label} className="flex items-stretch gap-[26px]">
                {i > 0 && <span className="w-px bg-bd" />}
                <div>
                  <div
                    className={`font-mono text-2xl font-semibold ${s.accent ? "text-teal" : "text-ink"}`}
                  >
                    {s.value}
                  </div>
                  <div className="mt-1.5 text-xs font-medium leading-[1.3] text-fnt">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* preview card */}
        <PortfolioPreview />
      </div>
    </section>
  );
}
