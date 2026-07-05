import { Trophy, Coins, Building2, PieChart, Info, Scale, Percent } from "lucide-react";
import { PanelHeading, Card, Callout, Ledger, LedgerRow, RuleTile } from "./how-ui";

/* Profit — where it comes from, how obligations reduce it, and the proportional share. */
export function TabProfit() {
  return (
    <div className="flex flex-col gap-5">
      <PanelHeading
        icon={Trophy}
        kicker="How the club earns & shares"
        title="Profit & fair shares"
        intro="Profit comes from loan interest and vendor returns. It's shared in proportion to what each member has actually paid in — never a flat slice — and the club never promises more than it has truly earned."
      />

      <div className="grid gap-2.5 sm:grid-cols-2">
        <RuleTile icon={Coins} label="Loan interest" detail="What borrowers pay to keep a loan — the club's main earner." />
        <RuleTile icon={Building2} label="Vendor returns" detail="Bank interest, chit payouts and other returns above what was invested." />
      </div>

      <Card title="Realized vs pending" icon={Info}>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <Mini title="Realized profit" body="Already collected and in the club's hands." tone="in" />
          <Mini title="Pending interest" body="Built up on active loans but not yet paid. The club will collect it, so it counts as profit." tone="teal" />
          <Mini title="Pending deposits" body="Members' own capital that's simply late — never counted as profit." tone="out" />
        </div>
      </Card>

      <Card title="Shareable profit & profit per member" icon={PieChart}>
        <p className="mb-3.5 text-13 font-medium leading-160 text-mut">
          Chit obligations are subtracted first, so the figure is never overstated. What&rsquo;s left is
          split by head into the dashboard&rsquo;s{" "}
          <span className="font-semibold text-ink">profit per member</span>.
        </p>
        <Ledger>
          <LedgerRow label="Realized profit + pending loan interest" value="+ collected & coming" tone="in" />
          <LedgerRow label="Less chit obligations & profit already paid out" value="− set aside" tone="out" />
          <LedgerRow label="Shareable profit ÷ number of members" value="= profit per member" tone="teal" emphasize />
        </Ledger>
      </Card>

      {/* Proportional sharing — the key fairness rule */}
      <Card title="Shared by how much you've paid in" icon={Scale}>
        <p className="mb-3.5 text-13 font-medium leading-160 text-mut">
          Each member earns the full per-head share{" "}
          <span className="font-semibold text-ink">
            times the fraction of their own deposits they&rsquo;ve paid
          </span>
          . If you&rsquo;re behind, you earn proportionally less &mdash; and the shortfall isn&rsquo;t
          handed to anyone else.
        </p>
        <Ledger>
          <LedgerRow label="Full per-head share" hint="Everyone's expected deposit so far: ₹30,000" value="₹9,000" tone="ink" />
          <LedgerRow label="This member paid ₹20,000 of ₹30,000" hint="Two-thirds paid → two-thirds of the share" value="× 2/3" tone="ink" />
          <LedgerRow label="Their actual profit share" value="₹6,000" tone="teal" emphasize />
          <LedgerRow label="The missing ₹3,000" hint="Stays pooled until they catch up — given to no one" value="held back" tone="out" />
        </Ledger>
        <Callout icon={Percent} tone="teal" className="mt-3.5" title="A fully-paid member is never affected by anyone else">
          They always earn their full per-head share, no matter how far behind others are. And because
          every share is capped and reduced for underpayment, the club can never share out more than it
          earned &mdash; even if everyone settled at once, its value would never go negative.
        </Callout>
      </Card>

      <Callout icon={Trophy} tone="neutral" title="No automatic payout — for now">
        Profit isn&rsquo;t paid out periodically. It accumulates as each member&rsquo;s growing share, and
        a member receives their share when they leave. A yearly dividend exists as a capability but is
        switched off.
      </Callout>
    </div>
  );
}

function Mini({ title, body, tone }: { title: string; body: string; tone: "in" | "out" | "teal" }) {
  const dot = { in: "bg-in", out: "bg-out", teal: "bg-teal" }[tone];
  return (
    <div className="rounded-14 border border-hair bg-sf2 p-3.5">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${dot}`} />
        <div className="text-13 font-bold leading-120 text-ink">{title}</div>
      </div>
      <div className="mt-1.5 text-xs font-medium leading-150 text-mut">{body}</div>
    </div>
  );
}
