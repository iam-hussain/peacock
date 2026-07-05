import {
  Workflow,
  Wallet,
  HandCoins,
  Coins,
  Building2,
  Trophy,
  DoorOpen,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MoneyFlow } from "./money-flow";
import { PanelHeading, Card, StatTile, Callout } from "./how-ui";

const CYCLE: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Wallet,
    title: "Members pay a monthly deposit",
    body: "Everyone contributes the same fixed amount each month. There's no central account — a member-treasurer physically holds the cash, and every rupee is recorded.",
  },
  {
    icon: HandCoins,
    title: "The club lends to members",
    body: "One loan at a time, funded in tranches as cash is needed, at a fixed daily interest rate locked in when the loan starts, over a five-month term.",
  },
  {
    icon: Coins,
    title: "Interest & repayments flow back",
    body: "Borrowers repay principal plus interest. Each repayment posts against the loan, so the outstanding balance and interest earned are always current.",
  },
  {
    icon: Building2,
    title: "Spare cash is invested with vendors",
    body: "Idle money is placed with banks, chit funds and other vendors. Investments and returns are recorded, and profit accrues to the club.",
  },
  {
    icon: Trophy,
    title: "Profit is shared fairly",
    body: "Profit is split in proportion to what each member has actually paid in. A catch-up mechanism keeps every member's value equal over time.",
  },
  {
    icon: DoorOpen,
    title: "Leaving settles everything",
    body: "A member exits by settling — capital plus their profit share, minus any loan owed. Their membership closes; the full history is kept.",
  },
];

const FACTS = [
  { value: "1% / mo", label: "Loan interest", sub: "Fixed at origination, charged daily" },
  { value: "₹5,00,000", label: "Maximum loan", sub: "Per member, one at a time" },
  { value: "5 months", label: "Loan term", sub: "Then flagged overdue" },
  { value: "₹2,000", label: "Monthly deposit", sub: "Raised from ₹1,000 in 2023" },
];

export function TabOverview() {
  return (
    <div className="flex flex-col gap-5">
      <PanelHeading
        icon={Workflow}
        kicker="The big picture"
        title="Where every rupee flows"
        intro="Members pool money each month. The club lends it out for interest and invests the rest with vendors — then shares the profit. Here's the whole loop at a glance, and every arrow of money in and out of the pool."
      />

      <MoneyFlow />

      <div>
        <h3 className="mb-3 text-15 font-bold leading-120 text-ink md:text-17">The full cycle</h3>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {CYCLE.map((s, i) => (
            <div
              key={s.title}
              className="flex items-start gap-3.5 rounded-14 border border-hair bg-sf p-4"
            >
              <div className="flex flex-none flex-col items-center gap-1.5">
                <span className="flex size-9 items-center justify-center rounded-11 bg-tlsf">
                  <s.icon className="size-4.5 text-teal" strokeWidth={2} />
                </span>
                <span className="font-mono text-10 font-bold leading-none text-fnt">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-13 font-bold leading-120 text-ink md:text-sm">{s.title}</div>
                <div className="mt-1.25 text-xs font-medium leading-155 text-mut">{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {FACTS.map((f) => (
            <StatTile key={f.label} value={f.value} label={f.label} sub={f.sub} />
          ))}
        </div>
      </Card>

      <Callout icon={ShieldCheck} title="No central cash box" tone="teal">
        The club owns no bank account. Its available cash is simply the sum of what every treasurer is
        holding right now &mdash; so almost every entry records{" "}
        <span className="font-semibold">which treasurer</span>{" "}the money came from or went to.
      </Callout>
    </div>
  );
}
