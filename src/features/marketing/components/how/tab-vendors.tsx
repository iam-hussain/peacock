import { Building2, Landmark, Layers, ArrowRightLeft, Info, TriangleAlert, Coins } from "lucide-react";
import { PanelHeading, Card, Callout, Ledger, LedgerRow } from "./how-ui";

/* Chit timeline: rising installments, an early payout, then the remaining installments
   the club still owes (the obligation). Widths are illustrative. */
const CHIT_BAR = [
  { grow: 60, label: "Months 1–12 · paying in", tint: "bg-teal" },
  { grow: 40, label: "Months 13–20 · obligation", tint: "bg-wfg/70" },
];

export function TabVendors() {
  return (
    <div className="flex flex-col gap-5">
      <PanelHeading
        icon={Building2}
        kicker="Growing the money outside"
        title="Vendors & chit funds"
        intro="Idle club cash is put to work outside the club — in a bank or general vendor, or in a chit fund. Anything that comes back above what went in is profit. Chits add one twist: a future commitment the club must keep paying."
      />

      {/* General vendor */}
      <Card title="General vendor (a bank counts as one)" icon={Landmark}>
        <p className="mb-3.5 text-13 font-medium leading-160 text-mut">
          Money goes out (invested) and comes back later (returns). Anything above what was invested is
          profit. A bank is just a general vendor &mdash; a treasurer parks spare club cash, the bank
          pays interest, and that interest returns to the club as profit.
        </p>
        <Ledger>
          <LedgerRow label="Invest with the vendor" hint="Money leaves the pool" value="−₹1,00,000" tone="out" />
          <LedgerRow label="Vendor returns the money" hint="Principal comes back" value="+₹1,00,000" tone="in" />
          <LedgerRow label="Interest paid by the bank" hint="Everything above principal is profit" value="+₹500" tone="in" />
          <LedgerRow label="Club profit from this vendor" value="₹500" tone="teal" emphasize />
        </Ledger>
      </Card>

      {/* Chit fund */}
      <Card title="Chit fund" icon={Layers}>
        <p className="mb-4 text-13 font-medium leading-160 text-mut">
          A fixed-term scheme &mdash; for example, a{" "}
          <span className="font-semibold text-ink">₹5,00,000 chit over 20 months</span>. The club pays a
          monthly installment that starts small and rises up to the{" "}
          <span className="font-semibold text-ink">margin</span>{" "}(₹5,00,000 ÷ 20 = ₹25,000), and receives
          a lump-sum payout at some point &mdash; often taken early.
        </p>

        {/* timeline */}
        <div className="flex h-9 gap-1 overflow-hidden rounded-11">
          {CHIT_BAR.map((s) => (
            <div
              key={s.label}
              style={{ flexGrow: s.grow }}
              className={`flex items-center justify-center px-2 text-center text-9 font-bold leading-tight text-white md:text-10 ${s.tint}`}
            >
              {s.label}
            </div>
          ))}
        </div>
        <div className="relative mt-1.5 h-4">
          <span className="absolute font-mono text-10 font-medium text-fnt" style={{ left: 0 }}>
            Start
          </span>
          <span
            className="absolute -translate-x-1/2 font-mono text-10 font-bold text-wfg"
            style={{ left: "60%" }}
          >
            ↑ payout (month 12)
          </span>
          <span className="absolute right-0 font-mono text-10 font-medium text-fnt">End</span>
        </div>

        <div className="mt-4">
          <Ledger>
            <LedgerRow label="Total installments paid (all 20 months)" hint="Rising up to the ₹25,000 margin" value="−₹4,40,000" tone="out" />
            <LedgerRow label="Payout received (month 12)" hint="A lump sum, taken early" value="+₹4,70,000" tone="in" />
            <LedgerRow label="Chit profit" hint="Payout − everything paid in (can be + or −)" value="₹30,000" tone="teal" emphasize />
          </Ledger>
        </div>
      </Card>

      {/* Obligation — the key concept */}
      <Card title="What is an obligation?" icon={ArrowRightLeft}>
        <p className="text-13 font-medium leading-160 text-mut">
          Even after taking the payout early, the club{" "}
          <span className="font-semibold text-ink">must keep paying</span>{" "}the remaining monthly
          installments until the term ends. That future commitment is tracked as an{" "}
          <span className="font-semibold text-ink">obligation</span>.
        </p>
        <div className="mt-3.5">
          <Ledger>
            <LedgerRow label="Payout already received" value="+₹4,70,000" tone="in" />
            <LedgerRow label="Installments still owed (months 13–20)" hint="8 remaining installments" value="−₹1,85,000" tone="out" />
            <LedgerRow label="Set aside as obligation" hint="Held back from shareable profit" value="₹1,85,000" tone="teal" emphasize />
          </Ledger>
        </div>
        <Callout icon={Info} tone="warn" title="Why obligation matters">
          The money the club still owes to chits is subtracted from its shareable profit &mdash; so the
          club never counts gains it hasn&rsquo;t fully earned yet, and never promises members profit it
          will later have to pay out.
        </Callout>
      </Card>

      <Callout icon={TriangleAlert} tone="neutral" title="When a vendor loses money">
        If money placed with a vendor is genuinely gone (a default, or a return below what was invested),
        the admin records a <span className="font-semibold text-ink">vendor write-off</span>{" "}&mdash; the
        real loss is booked honestly rather than hidden.
      </Callout>

      <div className="flex items-center justify-center gap-3 text-11 font-medium text-fnt">
        <span className="flex items-center gap-1.5">
          <Coins className="size-3.5 text-teal" strokeWidth={2.2} /> All vendor returns feed the
          club&rsquo;s shared profit
        </span>
      </div>
    </div>
  );
}
