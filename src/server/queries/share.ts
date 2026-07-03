import "server-only";
import { prisma } from "@/server/db";
import { formatPaise } from "@/lib/money";
import { initials, avatarColor } from "@/lib/avatar";
import { getCurrentUser } from "./session";
import { getDashboard } from "./dashboard";
import { getMembers, getMemberDetail } from "./members";
import { getLoans, getLoanStats } from "./loans";
import { getVendors, getVendorTotals } from "./vendors";

type Tint = { bg: string; fg: string };
type Stat = { label: string; value: string; accent?: boolean };
type Cell = { text: string; tone: "ink" | "mut" | "in" | "out" | "teal" };

export interface ShareMemberRow {
  id: string; ini: string; name: string; joined: string; avatar: Tint;
  deposit: string; profit: Cell; value: string; held: Cell; adjustment: Cell; pending: Cell;
  statusLabel: string; statusActive: boolean;
}
export interface ShareLoanRow {
  id: string; ini: string; member: string; open: boolean; tranches: number;
  start?: string; elapsed?: string; overdue?: boolean; pct: number; rate?: string;
  closedDate?: string; ran?: string; interestEarned?: string; interestDue?: string; interestUnpaid?: boolean;
  pending: Cell; amount: string; statusLabel: string; status: "active" | "overdue" | "closed";
}
export interface ShareVendorRow {
  id: string; ini: string; name: string; typeLabel: string; isChit: boolean;
  statusLabel: string; statusActive: boolean; sub: string; invested: string; profit: Cell; roi: Cell;
}
export interface ShareStatement {
  id: string; ini: string; name: string; joined: string; tenure: string; avatar: Tint; statusLabel: string; statusActive: boolean;
  deposits: string; returns: string; overallDue: Cell;
  contribution: { periodic: string; catchup: string; total: string; pending: Cell; paidRatioPct: number; fullShare: string };
  catchup: Ledger; penalty: Ledger;
  loans: {
    hasLoans: boolean; taken: string; repaid: string; current: Cell;
    interestGen: string; interestPaid: string; interestDue: Cell;
    cycles: { n: number; statusLabel: string; closed: boolean; amt: string; start: string; end: string; rate: string; days: string; interest: string }[];
  };
  holding: string;
}
type Ledger = { assigned: string; paid: string; remaining: Cell; pct: number };

export interface ShareData {
  hero: Stat[];
  groups: { title: string; items: { l: string; v: string }[] }[];
  members: ShareMemberRow[];
  loanStats: { label: string; value: string }[];
  loans: ShareLoanRow[];
  vendorStats: { label: string; value: string }[];
  vendors: ShareVendorRow[];
  statements: ShareStatement[];
  defaultMemberId: string | null;
}

const cell = (text: string | null, tone: Cell["tone"], zero = "₹0"): Cell =>
  text ? { text, tone } : { text: zero, tone: "mut" };
const nonZero = (v: string) => v !== "₹0" && v !== "₹0.00";

/** Everything the Share posters render: the full club report (summary + members + loans + vendors)
 * and a per-member statement for every member. Composed from the existing domain queries. */
export async function getShareData(): Promise<ShareData> {
  const [dash, members, loans, loanStats, vendors, vendorTotals, me] = await Promise.all([
    getDashboard(), getMembers(), getLoans(), getLoanStats(), getVendors(), getVendorTotals(), getCurrentUser(),
  ]);

  // Club summary: drop the big Portfolio hero (it's the poster's own headline elsewhere) and keep
  // only the four report groups the design shows.
  const hero: Stat[] = dash.hero.filter((h) => h.label !== "Portfolio value").map((h) => ({ label: h.label, value: h.value, accent: h.accent }));
  const groupTitles = ["Member funds", "Loans & interest", "Vendors", "Cash flow · 30d"];
  const groups = groupTitles.map((t) => dash.groups.find((g) => g.title === t)).filter((g): g is NonNullable<typeof g> => !!g);

  const memberRows: ShareMemberRow[] = members.map((m) => ({
    id: m.id, ini: initials(m.name), name: m.name, joined: m.joined, avatar: avatarColor(m.name),
    deposit: m.deposits,
    profit: cell(nonZero(m.profit) ? m.profit : null, "in", m.profit),
    value: m.value,
    held: cell(m.held, "teal", "—"),
    adjustment: cell(m.adjustment, "out", "—"),
    pending: cell(m.pending, "out", "₹0.00"),
    statusLabel: m.status === "active" ? "Active" : m.status === "left" ? "Left" : "Inactive",
    statusActive: m.status === "active",
  }));

  const openLoans = loans.filter((l) => l.open).length;
  const byLabel = (l: string) => loanStats.find((s) => s.label === l)?.value ?? "₹0";
  const loanStatTiles = [
    { label: "Open loans", value: String(openLoans) },
    { label: "Outstanding", value: byLabel("On loan now") },
    { label: "Interest due", value: byLabel("Interest due") },
    { label: "Interest earned", value: byLabel("Interest earned") },
  ];
  const loanRows: ShareLoanRow[] = loans.map((l) => ({
    id: l.id, ini: initials(l.member), member: l.member, open: l.open, tranches: l.tranches ?? 1,
    start: l.start, elapsed: l.elapsed, overdue: l.overdue, pct: l.pct ?? 0, rate: l.rate,
    closedDate: l.closedDate, ran: l.ran, interestEarned: l.interestEarned, interestDue: l.interestDue, interestUnpaid: l.interestUnpaid,
    pending: cell(l.pending ?? null, "out", "—"), amount: l.amount, statusLabel: l.statusLabel, status: l.status,
  }));

  const vendorStatTiles = [
    { label: "Vendors", value: String(vendors.length) },
    { label: "Invested", value: formatPaise(vendorTotals.invested) },
    { label: "Returns", value: formatPaise(vendorTotals.realized) },
  ];
  const vendorRows: ShareVendorRow[] = vendors.map((v) => ({
    id: v.id, ini: v.ini, name: v.name, typeLabel: v.typeLabel, isChit: v.type === "chit",
    statusLabel: v.statusLabel, statusActive: v.status === "active", sub: v.cycle,
    invested: v.invested,
    profit: cell(nonZero(v.profit) ? v.profit : null, v.roiPositive ? "in" : "out", v.profit),
    roi: { text: v.roi, tone: v.roiPositive ? "in" : "out" },
  }));

  // Per-member statements (single-member poster). Fetched concurrently; small club scale.
  const details = await Promise.all(members.map((m) => getMemberDetail(m.id)));
  const statements: ShareStatement[] = details.filter((d): d is NonNullable<typeof d> => !!d).map((d) => ({
    id: d.id, ini: initials(d.name), name: d.name, joined: d.joined, tenure: d.tenure, avatar: avatarColor(d.name),
    statusLabel: d.status === "active" ? "Active" : d.status === "left" ? "Left" : "Inactive", statusActive: d.status === "active",
    deposits: d.deposits, returns: d.returnsActual, overallDue: cell(d.overallPending, "out"),
    contribution: {
      periodic: d.periodic, catchup: d.catchup, total: d.totalDeposit,
      pending: cell(d.depositPending, "out"), paidRatioPct: d.paidRatioPct, fullShare: d.fullShare,
    },
    catchup: { assigned: d.ledgerAssigned, paid: d.ledgerPaid, remaining: cell(nonZero(d.ledgerRemaining) ? d.ledgerRemaining : null, "teal", d.ledgerRemaining), pct: d.ledgerPct },
    penalty: { assigned: d.penaltyAssigned, paid: d.penaltyPaid, remaining: cell(nonZero(d.penaltyRemaining) ? d.penaltyRemaining : null, "out", d.penaltyRemaining), pct: d.penaltyPct },
    loans: {
      hasLoans: d.hasLoans, taken: d.loanTaken, repaid: d.loanRepaid, current: cell(nonZero(d.currentLoan) ? d.currentLoan : null, "out", d.currentLoan),
      interestGen: d.interestGen, interestPaid: d.interestPaid, interestDue: cell(nonZero(d.interestDue) ? d.interestDue : null, "out", d.interestDue),
      cycles: d.cycles.map((c) => ({ n: c.n, statusLabel: c.statusLabel, closed: c.status === "closed", amt: c.amt, start: c.start, end: c.end, rate: c.rate, days: c.days, interest: c.interest })),
    },
    holding: d.value !== "—" ? d.value : d.deposits,
  }));

  return {
    hero, groups, members: memberRows,
    loanStats: loanStatTiles, loans: loanRows,
    vendorStats: vendorStatTiles, vendors: vendorRows,
    statements,
    defaultMemberId: me?.id ?? members[0]?.id ?? null,
  };
}
