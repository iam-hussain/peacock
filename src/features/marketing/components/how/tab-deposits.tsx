import { Wallet, Scale, Info, TriangleAlert, CalendarClock } from "lucide-react";
import { PanelHeading, Card, Callout, Ledger, LedgerRow, RuleTile } from "./how-ui";

/* Deposits & catch-up — the money members put in, and how late/new members reach equal value. */
export function TabDeposits() {
  return (
    <div className="flex flex-col gap-5">
      <PanelHeading
        icon={Wallet}
        kicker="Money members put in"
        title="Deposits & catch-up"
        intro="Every member saves the same fixed amount each month. New or returning members top up with a catch-up so everyone holds equal value — no one buys into years of growth they didn't help build."
      />

      <div className="grid gap-2.5 sm:grid-cols-2">
        <RuleTile icon={Wallet} label="Equal monthly deposit" detail="Today ₹2,000 for everyone — the same fixed amount, every month." />
        <RuleTile icon={CalendarClock} label="Measured across the club's life" detail="Your expected total runs from the club's start to today — identical for every active member." />
        <RuleTile icon={Scale} label="Catch-up equalises value" detail="A charge a late/returning member owes so their stake matches everyone else's." />
        <RuleTile icon={TriangleAlert} label="Late is flagged, not fined" detail="Unpaid deposits show as pending/overdue. The late-payment penalty is off today." />
      </div>

      <Card title="Deposits: paid vs expected" icon={Scale}>
        <p className="mb-3.5 text-13 font-medium leading-160 text-mut">
          The deposit amount has changed over the club&rsquo;s life (₹1,000 at the start, raised to ₹2,000
          in Sep 2023). Peacock knows, for any date, exactly what a member should have paid &mdash; and
          compares it to what they actually paid. The gap is their{" "}
          <span className="font-semibold text-ink">deposit pending</span>.
        </p>
        <Ledger>
          <LedgerRow label="Expected so far" hint="₹1,000 × 36 months + ₹2,000 × 32 months" value="₹1,00,000" tone="ink" />
          <LedgerRow label="Periodic deposits paid" hint="What this member has actually paid in" value="₹88,000" tone="in" />
          <LedgerRow label="Deposit pending" hint="Shown in red until it's cleared" value="₹12,000" tone="out" emphasize />
        </Ledger>
      </Card>

      <Card title="Catch-up: a charge, paid down over time" icon={Scale}>
        <p className="mb-3.5 text-13 font-medium leading-160 text-mut">
          A catch-up isn&rsquo;t a single payment &mdash; it&rsquo;s an amount the member{" "}
          <span className="font-semibold text-ink">owes</span>{" "}and pays down in any number of instalments.
          For a new or returning member the amount is auto-suggested (the profit gap that brings them to
          equal value) and the admin can edit it. Members can stack several catch-ups over time &mdash;
          each with a reason and date.
        </p>
        <Callout icon={Info} tone="neutral" title="Catch-up builds value — but doesn't clear deposit pending">
          Catch-up counts as the member&rsquo;s own capital and toward their profit share. But because
          it&rsquo;s profit-gap equalisation (not a monthly deposit), it never reduces the deposit
          shortfall &mdash; a member&rsquo;s monthly pending is always measured against periodic deposits
          only. Missed months are repaid separately as ordinary{" "}
          <span className="font-semibold">back deposits</span>.
        </Callout>
      </Card>

      <Callout icon={TriangleAlert} tone="warn" title="Deposits are capital, not profit">
        The money you save is your own money working inside the club &mdash; it&rsquo;s returned to you
        (plus your profit share) when you eventually leave. It is never counted as the club&rsquo;s
        profit.
      </Callout>
    </div>
  );
}
