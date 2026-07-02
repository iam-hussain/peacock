// Public "How Peacock works" content. Plain-language, consistent with PRODUCT.md / ABOUT.md.
export const HOW_STEPS = [
  {
    n: 1,
    title: "Members pay a monthly deposit",
    body: "Everyone contributes the same fixed amount each month. The club holds no central account — a member-treasurer physically holds the cash, and every deposit is recorded to the rupee.",
  },
  {
    n: 2,
    title: "The club lends to members",
    body: "One loan at a time, funded in tranches as cash is needed, at a fixed daily interest rate locked in when the loan starts and running over a five-month term.",
  },
  {
    n: 3,
    title: "Interest and repayments flow back",
    body: "Borrowers repay principal plus interest. Each repayment is posted against the loan, so the outstanding balance and interest earned are always current.",
  },
  {
    n: 4,
    title: "Spare cash is invested with vendors",
    body: "Idle money is placed with banks, chit funds and other vendors. Investments and returns are recorded, and profit accrues to the club.",
  },
  {
    n: 5,
    title: "Profit is shared fairly",
    body: "At close, profit is split in proportion to what each member actually paid in. A catch-up mechanism keeps every member's value equal over time.",
  },
];

export const HOW_FACTS = [
  { v: "1% / mo", l: "Loan interest", s: "Fixed at origination, charged daily." },
  { v: "₹5,00,000", l: "Maximum loan", s: "The most a member can borrow at once." },
  { v: "5 months", l: "Loan term", s: "One loan at a time, per member." },
];

// Terms & conditions — icon tint keys map to token classes in the component.
export type TermsIcon = "people" | "bank" | "gavel";

export const TERMS: {
  n: number;
  icon: TermsIcon;
  title: string;
  countLabel: string;
  items: { n: string; t: string; b: string }[];
}[] = [
  {
    n: 1,
    icon: "people",
    title: "Membership & contributions",
    countLabel: "4 clauses",
    items: [
      { n: "1.1", t: "Equal monthly deposit", b: "Every member contributes the same fixed amount each month. A member-treasurer physically holds the cash; the club keeps no central account." },
      { n: "1.2", t: "One person, one membership", b: "Each person has a single active membership at a time. A join opens a stint; leaving closes it, and rejoining opens a new one." },
      { n: "1.3", t: "Catch-up keeps value equal", b: "If a member falls behind, a catch-up charge restores parity so every member's stake reflects what they have paid in." },
      { n: "1.4", t: "Leaving is a full exit", b: "Withdrawal settles your balance and freezes the stint. You may rejoin later under a fresh membership." },
    ],
  },
  {
    n: 2,
    icon: "bank",
    title: "Loans & vendor investments",
    countLabel: "4 clauses",
    items: [
      { n: "2.1", t: "One loan at a time", b: "A member may hold a single loan, funded in tranches as cash is available, with a one-month cooldown before the next." },
      { n: "2.2", t: "Fixed rate, daily interest", b: "The interest rate is locked when the loan starts and charged daily over a five-month term." },
      { n: "2.3", t: "Borrow up to ₹5,00,000", b: "The maximum loan is five lakh rupees; the limit is revisable by the club." },
      { n: "2.4", t: "Vendor returns accrue to the club", b: "Money placed with banks, chit funds and other vendors earns for the club; returns are recorded against each vendor." },
    ],
  },
  {
    n: 3,
    icon: "gavel",
    title: "Governance & profit",
    countLabel: "4 clauses",
    items: [
      { n: "3.1", t: "Profit shared by contribution", b: "At close, profit is split in proportion to what each member has actually paid in — never equally by head." },
      { n: "3.2", t: "Money is exact", b: "Every amount is tracked to the paise and the double-entry ledger always balances." },
      { n: "3.3", t: "Amendments by consensus", b: "These terms change only by majority agreement of the members." },
      { n: "3.4", t: "Transparent to all", b: "Every member can see every recorded transaction, at any time." },
    ],
  },
];
