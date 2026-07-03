export type {
  LoanDTO as Loan,
  LoanStatusKey as LoanStatus,
} from "@/server/queries/loans";

export interface LoanStat {
  label: string;
  value: string;
  sub: string;
  tone?: "warn" | "out" | "in";
  count?: string; // shown inline beside the value on mobile (e.g. "1 loan")
}

export const LOAN_FILTERS = ["Pending", "Active", "Closed", "All"] as const;
