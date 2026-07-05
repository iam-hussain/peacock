import Link from "next/link";
import { HowTabs } from "./how/how-tabs";

/* Public "How Peacock works" guide — a tabbed, animated walk-through of the whole club:
   the money-flow, deposits & catch-up, loans & daily interest, vendors & chits, profit
   sharing, and the leave/rejoin lifecycle. One responsive layout, mobile → desktop.
   Page chrome (public header or the signed-in app bars) comes from PublicShell. */
export function HowItWorks({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <main className="mx-auto w-full max-w-270 px-4 pb-14 pt-5 md:px-6.5 md:pb-20 md:pt-10">
      {/* Hero */}
      <div className="mb-6 md:mb-8">
        <div className="text-11 font-semibold uppercase tracking-12 text-teal md:tracking-14">
          Guide
        </div>
        <h1 className="mt-2.5 font-display text-28 font-extrabold leading-105 tracking-[-0.025em] text-ink md:text-38">
          How Peacock works
        </h1>
        <p className="mt-2.5 max-w-150 text-13 font-medium leading-160 text-mut md:text-15">
          A chit-fund the way a treasurer actually runs it — money in, money out, every rupee
          accounted for. Pick a topic below to see the rules, the flows and the exact maths, with
          worked examples throughout.
        </p>
      </div>

      <HowTabs />

      {/* CTA — visitors only; members are already in */}
      {!signedIn && (
        <div className="mt-7 flex flex-col gap-3 rounded-2xl bg-teal p-5 sm:flex-row sm:items-center md:mt-9 md:p-6.5">
          <div className="flex-1">
            <div className="text-15 font-bold leading-120 text-white md:text-17">
              Ready to open your club?
            </div>
            <div className="mt-1.5 text-13 font-medium leading-150 text-teal-mut">
              Sign in to record deposits, loans and vendor returns — transparent to every member.
            </div>
          </div>
          <Link
            href="/login"
            className="flex-none rounded-11 bg-white px-5.5 py-3.5 text-center text-sm font-semibold leading-none text-teal"
          >
            Sign in
          </Link>
        </div>
      )}

      <Link
        href="/terms"
        className="mt-3 flex items-center justify-between rounded-xl border border-hair bg-sf2 px-4.5 py-3.75 md:hidden"
      >
        <span className="text-13 font-semibold leading-none text-ink">Terms &amp; conditions</span>
        <span className="text-sm font-semibold leading-none text-fnt">→</span>
      </Link>
    </main>
  );
}
