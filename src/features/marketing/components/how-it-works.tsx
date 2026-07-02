import Link from "next/link";
import { PublicHeader } from "./public-header";
import { MobileBackHeader } from "@/components/shared/mobile-back-header";
import { HOW_STEPS, HOW_FACTS } from "../data";

export function HowItWorks() {
  return (
    <>
      {/* Desktop */}
      <div className="hidden min-h-screen flex-col bg-bg md:flex">
        <PublicHeader />
        <main className="flex-1 px-7 pb-16 pt-[46px]">
          <div className="mx-auto max-w-[920px] animate-in fade-in">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">
              Guide
            </div>
            <h1 className="mb-2 font-display text-[38px] font-extrabold leading-[1.03] tracking-[-0.025em] text-ink">
              How Peacock works
            </h1>
            <p className="mb-[30px] max-w-[560px] text-[15px] font-medium leading-[1.55] text-mut">
              A chit-fund the way a treasurer actually runs it — money in, money out, every rupee
              accounted for. Here&apos;s the full cycle, start to finish.
            </p>

            <div className="flex flex-col gap-3.5">
              {HOW_STEPS.map((s) => (
                <div
                  key={s.n}
                  className="flex items-start gap-[18px] rounded-2xl border border-hair bg-sf px-[22px] py-5"
                >
                  <StepNumber n={s.n} size={38} radius={11} font="text-base" />
                  <div className="flex-1">
                    <div className="text-base font-bold leading-[1.2] text-ink">{s.title}</div>
                    <div className="mt-[7px] text-[13px] font-medium leading-[1.55] text-mut">{s.body}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3.5 grid grid-cols-3 gap-3.5">
              {HOW_FACTS.map((f) => (
                <div key={f.l} className="rounded-[14px] border border-hair bg-sf p-[18px]">
                  <div className="font-mono text-[25px] font-semibold leading-none text-teal">{f.v}</div>
                  <div className="mt-[9px] text-xs font-semibold leading-[1.3] text-ink">{f.l}</div>
                  <div className="mt-1 text-[11px] font-medium leading-[1.4] text-fnt">{f.s}</div>
                </div>
              ))}
            </div>

            <CtaBanner />
          </div>
        </main>
      </div>

      {/* Mobile */}
      <div className="flex min-h-screen flex-col bg-bg md:hidden">
        <MobileBackHeader title="How it works" backHref="/" />
        <main className="px-4 py-[18px]">
          <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal">
            Guide
          </div>
          <h1 className="mb-2 font-display text-[25px] font-extrabold leading-[1.06] tracking-[-0.02em] text-ink">
            How Peacock works
          </h1>
          <p className="mb-[18px] text-[13px] font-medium leading-[1.55] text-mut">
            A chit-fund the way a treasurer actually runs it — money in, money out, every rupee
            accounted for.
          </p>

          <div className="flex flex-col gap-[11px]">
            {HOW_STEPS.map((s) => (
              <div
                key={s.n}
                className="flex items-start gap-[13px] rounded-[14px] border border-hair bg-sf px-4 py-[15px]"
              >
                <StepNumber n={s.n} size={32} radius={9} font="text-sm" />
                <div className="flex-1">
                  <div className="text-sm font-bold leading-[1.25] text-ink">{s.title}</div>
                  <div className="mt-1.5 text-xs font-medium leading-[1.55] text-mut">{s.body}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-[11px] rounded-[14px] bg-teal p-[18px]">
            <div className="text-[15px] font-bold leading-[1.2] text-white">Ready to open your club?</div>
            <div className="mb-3.5 mt-1.5 text-xs font-medium leading-[1.5] text-teal-mut">
              Sign in to record deposits, loans and vendor returns.
            </div>
            <Link
              href="/login"
              className="block rounded-[11px] bg-white p-[13px] text-center text-[13px] font-semibold leading-none text-teal"
            >
              Sign in
            </Link>
          </div>

          <Link
            href="/terms"
            className="mt-[11px] flex items-center justify-between rounded-xl border border-hair bg-sf px-[15px] py-3.5"
          >
            <span className="text-[13px] font-semibold leading-none text-ink">Terms &amp; conditions</span>
            <span className="text-sm font-semibold leading-none text-fnt">→</span>
          </Link>
        </main>
      </div>
    </>
  );
}

function StepNumber({ n, size, radius, font }: { n: number; size: number; radius: number; font: string }) {
  return (
    <div
      className={`flex flex-none items-center justify-center bg-tlsf font-mono font-bold leading-none text-teal ${font}`}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      {n}
    </div>
  );
}

function CtaBanner() {
  return (
    <div className="mt-3.5 flex items-center gap-5 rounded-2xl bg-teal px-[26px] py-6">
      <div className="flex-1">
        <div className="text-[17px] font-bold leading-[1.2] text-white">Ready to open your club?</div>
        <div className="mt-1.5 text-[13px] font-medium leading-[1.5] text-teal-mut">
          Sign in to record deposits, loans and vendor returns — transparent to every member.
        </div>
      </div>
      <Link
        href="/login"
        className="flex-none rounded-[11px] bg-white px-[22px] py-3.5 text-sm font-semibold leading-none text-teal"
      >
        Sign in
      </Link>
    </div>
  );
}
