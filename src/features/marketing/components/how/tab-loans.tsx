import {
  HandCoins,
  Ban,
  Timer,
  CircleDollarSign,
  CalendarDays,
  Repeat,
  Split,
  Percent,
  Info,
  TriangleAlert,
  RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PanelHeading, Card, Callout, Ledger, LedgerRow, RuleTile, FlowChip } from "./how-ui";

const RULES: { icon: LucideIcon; label: string; detail: string }[] = [
  { icon: CircleDollarSign, label: "Up to ₹5,00,000", detail: "The most a member can borrow (an admin setting)." },
  { icon: HandCoins, label: "One loan at a time", detail: "Clear any existing loan fully before taking another." },
  { icon: Ban, label: "No top-ups", detail: "You can't add to a running loan — take a fresh one later." },
  { icon: Timer, label: "1-month cooldown", detail: "Wait a month after closing a loan before borrowing again." },
  { icon: CalendarDays, label: "5-month term", detail: "Repay within five months; after that it's flagged overdue." },
  { icon: Repeat, label: "Repay anytime", detail: "Any amount, whenever — no minimum repayment." },
];

/* Proportional widths for the loan timeline bar (≈ 2 months + 25 days). */
const SEGMENTS = [
  { grow: 30, label: "Month 1", tint: "bg-teal" },
  { grow: 30, label: "Month 2", tint: "bg-teal/70" },
  { grow: 25, label: "25 days", tint: "bg-gold" },
];

export function TabLoans() {
  return (
    <div className="flex flex-col gap-5">
      <PanelHeading
        icon={HandCoins}
        kicker="Lending, precisely"
        title="Loans & daily interest"
        intro="Loans are the club's main source of profit. The rate is fixed the day the loan starts and interest is charged by the day — so it's always fair, and the live figure shows exactly what's owed today."
      />

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {RULES.map((r) => (
          <RuleTile key={r.label} icon={r.icon} label={r.label} detail={r.detail} />
        ))}
      </div>

      <Card title="Disbursed in tranches" icon={Split}>
        <p className="text-13 font-medium leading-160 text-mut">
          No single treasurer may hold enough cash, so one loan can be paid out in pieces &mdash; from
          different treasurers, over a few days. It&rsquo;s still{" "}
          <span className="font-semibold text-ink">one loan</span>{" "}with one start date, and interest tracks
          whatever is actually outstanding at each moment.
        </p>
        <div className="mt-3.5 flex items-center gap-2.5 rounded-14 border border-hair bg-sf2 p-3.5 text-13 md:gap-3">
          <span className="hidden flex-none rounded-9 bg-tlsf px-2.5 py-1.5 font-mono text-11 font-semibold text-teal sm:inline">
            ₹2,50,000
          </span>
          <p className="font-medium leading-155 text-mut">
            Approved for ₹2,50,000. Treasurer A gives ₹1,00,000 today; a week later Treasurer B gives
            ₹1,50,000. For that first week interest is on ₹1,00,000 &mdash; then on the full ₹2,50,000.
          </p>
        </div>
      </Card>

      <Card title="How interest is counted" icon={Percent}>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <MiniRule n="1" title="Full months" body="Counted from the start day (e.g. 5th → 5th). Each completed month charges the full 1%." />
          <MiniRule n="2" title="Leftover days" body="Beyond the last full month, each day charges 1% ÷ 30 — a fixed 30-day convention." />
          <MiniRule n="3" title="Balance changes reset" body="Every time the outstanding changes (repay or new tranche), the month-count restarts for the new amount." />
        </div>
      </Card>

      {/* The worked example — the centrepiece */}
      <section className="overflow-hidden rounded-2xl border border-teal/30 bg-sf">
        <div className="flex items-center gap-2.5 border-b border-hair bg-tlsf/50 px-4.5 py-3.5">
          <CircleDollarSign className="size-4.5 text-teal" strokeWidth={2.2} />
          <h3 className="flex-1 text-15 font-bold leading-120 text-ink md:text-17">Worked example</h3>
          <FlowChip dir="in" />
        </div>

        <div className="p-4.5 md:p-5.5">
          <p className="text-13 font-medium leading-160 text-mut">
            A member borrows <span className="font-semibold text-ink">₹50,000</span>{" "}at{" "}
            <span className="font-semibold text-ink">1% / month</span>{" "}on 5 Apr and keeps it until 30 Jun
            &mdash; that&rsquo;s <span className="font-semibold text-ink">2 months and 25 days</span>.
          </p>

          {/* timeline */}
          <div className="mt-4">
            <div className="flex h-9 gap-1 overflow-hidden rounded-11">
              {SEGMENTS.map((s) => (
                <div
                  key={s.label}
                  style={{ flexGrow: s.grow }}
                  className={`flex items-center justify-center text-10 font-bold leading-none text-white ${s.tint}`}
                >
                  {s.label}
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-10 font-medium text-fnt">
              <span>5 Apr</span>
              <span>30 Jun</span>
            </div>
          </div>

          {/* the maths */}
          <div className="mt-4">
            <Ledger>
              <LedgerRow label="Month 1 — 5 Apr → 5 May" hint="1% of ₹50,000" value="₹500.00" tone="ink" />
              <LedgerRow label="Month 2 — 5 May → 5 Jun" hint="1% of ₹50,000" value="₹500.00" tone="ink" />
              <LedgerRow
                label="25 days — 5 Jun → 30 Jun"
                hint="daily rate = ₹500 ÷ 30 days = ₹16.67 → × 25 days"
                value="₹416.67"
                tone="ink"
              />
              <LedgerRow label="Interest owed so far" value="₹1,416.67" tone="teal" emphasize />
            </Ledger>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-14 border border-hair bg-sf2 p-3.5">
            <RefreshCw className="mt-0.25 size-4.5 flex-none text-teal" strokeWidth={2.2} />
            <p className="text-xs font-medium leading-160 text-mut md:text-13">
              If the member now repays <span className="font-semibold text-ink">₹20,000</span>, the
              remaining <span className="font-semibold text-ink">₹30,000</span>{" "}starts a fresh month-count
              from that day &mdash; interest from then on is charged only on ₹30,000, until it&rsquo;s
              cleared.
            </p>
          </div>
        </div>
      </section>

      <Callout icon={Info} tone="neutral" title="A note on dates">
        Before 1 Jun 2024 interest was charged by whole months only (a part-month rounded up). From that
        date the daily method above applies &mdash; this mostly matters for older loans.
      </Callout>

      <Callout icon={TriangleAlert} tone="warn" title="Overdue loans are flagged, not auto-fined">
        Past the five-month term a loan is marked overdue but stays active &mdash; it isn&rsquo;t
        cancelled. The overdue penalty is off today; the club can switch it on any time, and it would
        then apply to all loans at once.
      </Callout>
    </div>
  );
}

function MiniRule({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-14 border border-hair bg-sf2 p-3.5">
      <span className="flex size-6 items-center justify-center rounded-full bg-teal font-mono text-11 font-bold leading-none text-white">
        {n}
      </span>
      <div className="mt-2.5 text-13 font-bold leading-120 text-ink">{title}</div>
      <div className="mt-1 text-xs font-medium leading-150 text-mut">{body}</div>
    </div>
  );
}
