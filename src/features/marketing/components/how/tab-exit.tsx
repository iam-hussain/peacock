import {
  DoorOpen,
  LogOut,
  UserPlus,
  ShieldAlert,
  Info,
  Landmark,
  Gavel,
  History,
} from "lucide-react";
import { PanelHeading, Card, Callout, Ledger, LedgerRow, RuleTile } from "./how-ui";

/* Leaving, rejoining and penalties — the full member lifecycle at the edges. */
export function TabExit() {
  return (
    <div className="flex flex-col gap-5">
      <PanelHeading
        icon={DoorOpen}
        kicker="The member lifecycle"
        title="Leaving, rejoining & penalties"
        intro="Leaving is a full exit — settle everything and the membership closes, with all history kept. Peacock works like a bank: the person stays one customer, and each stint is a separate membership."
      />

      {/* Leaving */}
      <Card title="Leaving — settle & close" icon={LogOut}>
        <p className="mb-3.5 text-13 font-medium leading-160 text-mut">
          There&rsquo;s no partial exit and no &ldquo;take just the profit&rdquo; option &mdash; it&rsquo;s
          all or nothing. Peacock computes a suggested settlement; the admin enters the final cash paid
          out (from a treasurer), booked as its real parts, not one lump.
        </p>
        <Ledger>
          <LedgerRow label="Paid-in capital" hint="Deposits + catch-up" value="+ capital" tone="in" />
          <LedgerRow label="Profit share" hint="Reduced if they underpaid deposits" value="+ profit" tone="in" />
          <LedgerRow label="Any loan still owed" value="− loan" tone="out" />
          <LedgerRow label="Any unpaid interest" value="− interest" tone="out" />
          <LedgerRow label="Suggested settlement" hint="Admin confirms the final amount" value="= paid out" tone="teal" emphasize />
        </Ledger>
        <Callout icon={Info} tone="neutral" className="mt-3.5" title="After settling">
          The member&rsquo;s profit becomes zero and their current membership is marked Closed (with leave
          date and settled amount). Nothing is deleted &mdash; it becomes a previous membership in their
          history. Their profit is tracked as paid out, so it correctly leaves the pool.
        </Callout>
      </Card>

      {/* Rejoining */}
      <Card title="Rejoining — a fresh membership" icon={UserPlus}>
        <p className="mb-3.5 text-13 font-medium leading-160 text-mut">
          A closed member can come back, which opens a new membership (#N+1). Because their old deposits
          were paid back on exit, the new stint starts at zero paid &mdash; they owe the full baseline
          afresh.
        </p>
        <Ledger>
          <LedgerRow label="Back deposits" hint="Full monthly deposits since the club's start" value="+ baseline" tone="ink" />
          <LedgerRow label="Catch-up (auto-added, editable)" hint="Posted as a charge tagged “Rejoin”" value="+ catch-up" tone="ink" />
          <LedgerRow label="Total to rejoin" hint="Paid down over any number of instalments" value="= to equal value" tone="teal" emphasize />
        </Ledger>
      </Card>

      <Callout icon={Landmark} tone="teal" title="The bank model">
        One person, one login &mdash; but each time in the club is a separate membership, like an account
        that opens when you join and closes when you leave. Old memberships stay on file as read-only
        history, linked to the same person.
      </Callout>

      {/* Penalties */}
      <Card title="Penalties" icon={Gavel}>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <RuleTile
            icon={ShieldAlert}
            label="Overdue-loan penalty"
            detail="Automatic extra interest on loans past the 5-month term. A config switch — off today, applies to all loans at once when on."
          />
          <RuleTile
            icon={Gavel}
            label="Penalty charge"
            detail="A manual charge the admin raises (e.g. delayed payment). Owed and paid down over time — and it's club income, shared as profit."
          />
        </div>
        <Callout icon={Info} tone="neutral" title="Catch-up vs penalty">
          Both are charges the member owes and pays down in instalments. The difference: catch-up builds
          the member&rsquo;s <span className="font-semibold text-ink">own value</span>; a penalty is{" "}
          <span className="font-semibold text-ink">club income</span>{" "}shared among everyone. Overdue loans
          and late deposits are always flagged regardless of any penalty.
        </Callout>
      </Card>

      <div className="flex items-center justify-center gap-2 text-11 font-medium text-fnt">
        <History className="size-3.5" strokeWidth={2.2} /> Nothing is ever deleted &mdash; every exit and
        rejoin stays on record.
      </div>
    </div>
  );
}
