import Link from "next/link";
import { Users, Landmark, Gavel, type LucideIcon } from "lucide-react";
import { PublicHeader } from "./public-header";
import { MobileBackHeader } from "@/components/shared/mobile-back-header";
import { TERMS, type TermsIcon } from "../data";

const ICONS: Record<TermsIcon, { Icon: LucideIcon; bg: string; fg: string }> = {
  people: { Icon: Users, bg: "bg-tlsf", fg: "text-teal" },
  bank: { Icon: Landmark, bg: "bg-wbg", fg: "text-wfg" },
  gavel: { Icon: Gavel, bg: "bg-nbg", fg: "text-nfg" },
};

export function Terms() {
  return (
    <>
      {/* Desktop */}
      <div className="hidden min-h-screen flex-col bg-bg md:flex">
        <PublicHeader showTerms={false} showHowItWorks />
        <main className="flex-1 px-7 pb-16 pt-[46px]">
          <div className="mx-auto max-w-[920px] animate-in fade-in">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">Policy</div>
            <h1 className="mb-2 font-display text-[38px] font-extrabold leading-[1.03] tracking-[-0.025em] text-ink">
              Club terms &amp; conditions
            </h1>
            <p className="mb-[30px] max-w-[600px] text-[15px] font-medium leading-[1.55] text-mut">
              The rules every member agrees to — how contributions, loans and the club&apos;s shared
              profit are governed. Written plainly, applied to all equally.
            </p>

            <div className="flex flex-col gap-4">
              {TERMS.map((sec) => {
                const { Icon, bg, fg } = ICONS[sec.icon];
                return (
                  <section key={sec.n} className="overflow-hidden rounded-2xl border border-hair bg-sf">
                    <div className="flex items-center gap-[15px] border-b border-hair px-[22px] py-[18px]">
                      <div className={`flex size-10 flex-none items-center justify-center rounded-[11px] ${bg}`}>
                        <Icon className={`size-5 ${fg}`} strokeWidth={2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-[5px] font-mono text-[10px] font-semibold leading-none tracking-[0.06em] text-fnt">
                          SECTION {sec.n}
                        </div>
                        <div className="text-lg font-bold leading-[1.1] tracking-[-0.01em] text-ink">
                          {sec.title}
                        </div>
                      </div>
                      <div className="flex-none rounded-[20px] bg-tlsf px-3 py-1.5 text-[11px] font-semibold leading-none text-teal">
                        {sec.countLabel}
                      </div>
                    </div>
                    {sec.items.map((it) => (
                      <div key={it.n} className="flex items-start gap-[15px] border-b border-hr2 px-[22px] py-4 last:border-b-0">
                        <div className="flex-none font-mono text-xs font-semibold leading-[1.6] text-fnt">{it.n}</div>
                        <div className="flex-1">
                          <div className="text-sm font-bold leading-[1.3] text-ink">{it.t}</div>
                          <div className="mt-1.5 text-[13px] font-medium leading-[1.6] text-mut">{it.b}</div>
                        </div>
                      </div>
                    ))}
                  </section>
                );
              })}
            </div>

            <Link
              href="/how-it-works"
              className="mt-4 flex items-center gap-5 rounded-2xl bg-teal px-[26px] py-[22px]"
            >
              <div className="flex-1">
                <div className="text-[17px] font-bold leading-[1.2] text-white">New to how the club runs?</div>
                <div className="mt-1.5 text-[13px] font-medium leading-[1.5] text-teal-mut">
                  Walk through the full cycle — deposits, loans, vendor returns and where the profit goes.
                </div>
              </div>
              <span className="flex-none whitespace-nowrap rounded-[11px] bg-white px-5 py-3.5 text-sm font-semibold leading-none text-teal">
                See how it works →
              </span>
            </Link>

            <p className="mt-[22px] text-center text-xs font-medium leading-[1.5] text-fnt">
              Last updated June 2026 · Amendments require majority member consensus · Peacock Club
            </p>
          </div>
        </main>
      </div>

      {/* Mobile */}
      <div className="flex min-h-screen flex-col bg-bg md:hidden">
        <MobileBackHeader title="Terms & conditions" backHref="/" />
        <main className="px-4 py-[18px]">
          <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal">Policy</div>
          <h1 className="mb-2 font-display text-[25px] font-extrabold leading-[1.06] tracking-[-0.02em] text-ink">
            Club terms &amp; conditions
          </h1>
          <p className="mb-[18px] text-[13px] font-medium leading-[1.55] text-mut">
            The rules every member agrees to — contributions, loans and the club&apos;s shared profit,
            applied to all equally.
          </p>

          <div className="flex flex-col gap-3">
            {TERMS.map((sec) => {
              const { Icon, bg, fg } = ICONS[sec.icon];
              return (
                <section key={sec.n} className="overflow-hidden rounded-[14px] border border-hair bg-sf">
                  <div className="flex items-center gap-3 border-b border-hair px-[15px] py-3.5">
                    <div className={`flex size-[34px] flex-none items-center justify-center rounded-[9px] ${bg}`}>
                      <Icon className={`size-[17px] ${fg}`} strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 font-mono text-[9px] font-semibold leading-none tracking-[0.06em] text-fnt">
                        SECTION {sec.n}
                      </div>
                      <div className="text-[15px] font-bold leading-[1.15] text-ink">{sec.title}</div>
                    </div>
                  </div>
                  {sec.items.map((it) => (
                    <div key={it.n} className="flex items-start gap-3 border-b border-hr2 px-[15px] py-[13px] last:border-b-0">
                      <div className="flex-none font-mono text-[11px] font-semibold leading-[1.5] text-fnt">{it.n}</div>
                      <div className="flex-1">
                        <div className="text-[13px] font-bold leading-[1.3] text-ink">{it.t}</div>
                        <div className="mt-[5px] text-xs font-medium leading-[1.6] text-mut">{it.b}</div>
                      </div>
                    </div>
                  ))}
                </section>
              );
            })}
          </div>

          <Link href="/how-it-works" className="mt-3 block rounded-[14px] bg-teal p-[18px]">
            <div className="text-[15px] font-bold leading-[1.2] text-white">New to how the club runs?</div>
            <div className="mb-3.5 mt-1.5 text-xs font-medium leading-[1.5] text-teal-mut">
              Walk through the full cycle, start to finish.
            </div>
            <div className="rounded-[11px] bg-white p-[13px] text-center text-[13px] font-semibold leading-none text-teal">
              See how it works →
            </div>
          </Link>

          <p className="mt-4 text-center text-[11px] font-medium leading-[1.5] text-fnt">
            Last updated June 2026 · Peacock Club
          </p>
        </main>
      </div>
    </>
  );
}
