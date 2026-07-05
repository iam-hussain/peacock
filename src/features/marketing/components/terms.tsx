import Link from "next/link";
import { Users, Landmark, Gavel, type LucideIcon } from "lucide-react";
import { TERMS, type TermsIcon } from "../data";

const ICONS: Record<TermsIcon, { Icon: LucideIcon; bg: string; fg: string }> = {
  people: { Icon: Users, bg: "bg-tlsf", fg: "text-teal" },
  bank: { Icon: Landmark, bg: "bg-wbg", fg: "text-wfg" },
  gavel: { Icon: Gavel, bg: "bg-nbg", fg: "text-nfg" },
};

export function Terms() {
  return (
    <>
      {/* Desktop — page chrome comes from PublicShell */}
      <div className="hidden md:block">
        <main className="px-6.5 pb-16 pt-11.5">
          <div className="mx-auto max-w-270 animate-in fade-in">
            <div className="mb-3 text-11 font-semibold uppercase tracking-14 text-teal">Policy</div>
            <h1 className="mb-2 font-display text-38 font-extrabold leading-103 tracking-[-0.025em] text-ink">
              Club terms &amp; conditions
            </h1>
            <p className="mb-7.5 max-w-[600px] text-15 font-medium leading-155 text-mut">
              The rules every member agrees to — how contributions, loans and the club&apos;s shared
              profit are governed. Written plainly, applied to all equally.
            </p>

            <div className="flex flex-col gap-4">
              {TERMS.map((sec) => {
                const { Icon, bg, fg } = ICONS[sec.icon];
                return (
                  <section key={sec.n} className="overflow-hidden rounded-2xl border border-hair bg-sf">
                    <div className="flex items-center gap-3.75 border-b border-hair px-5.5 py-4.5">
                      <div className={`flex size-10 flex-none items-center justify-center rounded-11 ${bg}`}>
                        <Icon className={`size-5 ${fg}`} strokeWidth={2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.25 font-mono text-10 font-semibold leading-none tracking-6 text-fnt">
                          SECTION {sec.n}
                        </div>
                        <div className="text-lg font-bold leading-110 tracking-[-0.01em] text-ink">
                          {sec.title}
                        </div>
                      </div>
                      <div className="flex-none rounded-20 bg-tlsf px-3 py-1.5 text-11 font-semibold leading-none text-teal">
                        {sec.countLabel}
                      </div>
                    </div>
                    {sec.items.map((it) => (
                      <div key={it.n} className="flex items-start gap-3.75 border-b border-hr2 px-5.5 py-4 last:border-b-0">
                        <div className="flex-none font-mono text-xs font-semibold leading-160 text-fnt">{it.n}</div>
                        <div className="flex-1">
                          <div className="text-sm font-bold leading-130 text-ink">{it.t}</div>
                          <div className="mt-1.5 text-13 font-medium leading-160 text-mut">{it.b}</div>
                        </div>
                      </div>
                    ))}
                  </section>
                );
              })}
            </div>

            <Link
              href="/how-it-works"
              className="mt-4 flex items-center gap-5 rounded-2xl bg-teal px-6.5 py-5.5"
            >
              <div className="flex-1">
                <div className="text-17 font-bold leading-120 text-white">New to how the club runs?</div>
                <div className="mt-1.5 text-13 font-medium leading-150 text-teal-mut">
                  Walk through the full cycle — deposits, loans, vendor returns and where the profit goes.
                </div>
              </div>
              <span className="flex-none whitespace-nowrap rounded-11 bg-white px-5 py-3.5 text-sm font-semibold leading-none text-teal">
                See how it works →
              </span>
            </Link>

            <p className="mt-5.5 text-center text-xs font-medium leading-150 text-fnt">
              Last updated June 2026 · Amendments require majority member consensus · Peacock Club
            </p>
          </div>
        </main>
      </div>

      {/* Mobile — page chrome comes from PublicShell */}
      <div className="md:hidden">
        <main className="px-4 py-4.5">
          <div className="mb-2.5 text-11 font-semibold uppercase tracking-12 text-teal">Policy</div>
          <h1 className="mb-2 font-display text-25 font-extrabold leading-106 tracking-[-0.02em] text-ink">
            Club terms &amp; conditions
          </h1>
          <p className="mb-4.5 text-13 font-medium leading-155 text-mut">
            The rules every member agrees to — contributions, loans and the club&apos;s shared profit,
            applied to all equally.
          </p>

          <div className="flex flex-col gap-3">
            {TERMS.map((sec) => {
              const { Icon, bg, fg } = ICONS[sec.icon];
              return (
                <section key={sec.n} className="overflow-hidden rounded-14 border border-hair bg-sf">
                  <div className="flex items-center gap-3 border-b border-hair px-3.75 py-3.5">
                    <div className={`flex size-8.5 flex-none items-center justify-center rounded-9 ${bg}`}>
                      <Icon className={`size-4.25 ${fg}`} strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 font-mono text-9 font-semibold leading-none tracking-6 text-fnt">
                        SECTION {sec.n}
                      </div>
                      <div className="text-15 font-bold leading-115 text-ink">{sec.title}</div>
                    </div>
                  </div>
                  {sec.items.map((it) => (
                    <div key={it.n} className="flex items-start gap-3 border-b border-hr2 px-3.75 py-3.25 last:border-b-0">
                      <div className="flex-none font-mono text-11 font-semibold leading-150 text-fnt">{it.n}</div>
                      <div className="flex-1">
                        <div className="text-13 font-bold leading-130 text-ink">{it.t}</div>
                        <div className="mt-1.25 text-xs font-medium leading-160 text-mut">{it.b}</div>
                      </div>
                    </div>
                  ))}
                </section>
              );
            })}
          </div>

          <Link href="/how-it-works" className="mt-3 block rounded-14 bg-teal p-4.5">
            <div className="text-15 font-bold leading-120 text-white">New to how the club runs?</div>
            <div className="mb-3.5 mt-1.5 text-xs font-medium leading-150 text-teal-mut">
              Walk through the full cycle, start to finish.
            </div>
            <div className="rounded-11 bg-white p-3.25 text-center text-13 font-semibold leading-none text-teal">
              See how it works →
            </div>
          </Link>

          <p className="mt-4 text-center text-11 font-medium leading-150 text-fnt">
            Last updated June 2026 · Peacock Club
          </p>
        </main>
      </div>
    </>
  );
}
