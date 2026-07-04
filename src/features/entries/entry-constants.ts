import { ArrowDown, ArrowUp, ArrowLeftRight, type LucideIcon } from "lucide-react";

export type Dir = "in" | "out" | "move";
export interface Intent {
  label: string;
  desc: string;
  dir: Dir;
}

export const GROUPS: { name: string; items: Intent[] }[] = [
  {
    name: "Member",
    items: [
      { label: "Member paid deposit", desc: "Monthly contribution coming in", dir: "in" },
      { label: "Funds transfer", desc: "Move money between treasurers (cash holders)", dir: "move" },
    ],
  },
  {
    name: "Loan",
    items: [
      { label: "Give a loan", desc: "Disburse funds to a member", dir: "out" },
      { label: "Record repayment", desc: "Member repays loan principal", dir: "in" },
      { label: "Collect interest", desc: "Interest earned on a loan", dir: "in" },
    ],
  },
  {
    name: "Vendor",
    items: [
      { label: "Vendor investment", desc: "Place capital with a vendor", dir: "out" },
      { label: "Vendor return", desc: "Returns paid back by a vendor", dir: "in" },
    ],
  },
  {
    name: "Chit",
    items: [
      { label: "Chit installment", desc: "Monthly installment to a chit", dir: "out" },
      { label: "Chit payout", desc: "Lump sum received from a chit", dir: "in" },
    ],
  },
];

// Note: catch-up & penalty are recorded from the member's own page (they need the member's
// remaining balance + suggested amount), and vendor write-off from the vendor page — so none of
// them appear in this top-bar picker (§15).

export const DIR_META: Record<Dir, { Icon: LucideIcon; badge: string; tile: string; color: string }> = {
  in: { Icon: ArrowDown, badge: "IN", tile: "bg-in/10", color: "text-in" },
  out: { Icon: ArrowUp, badge: "OUT", tile: "bg-out/10", color: "text-out" },
  move: { Icon: ArrowLeftRight, badge: "MOVE", tile: "bg-bg2", color: "text-mut" },
};

export const INTENT_DIR: Record<string, Dir> = Object.fromEntries(
  GROUPS.flatMap((g) => g.items).map((it) => [it.label, it.dir]),
);
export const VENDOR_INTENTS = new Set(["Vendor investment", "Vendor return", "Chit installment", "Chit payout"]);

// Which member figure to show under each name in the picker (context-aware sub-line).
export const MEMBER_CTX_KEY: Record<string, "dues" | "loan" | "interest"> = {
  "Member paid deposit": "dues",
  "Record repayment": "loan",
  "Collect interest": "interest",
};
