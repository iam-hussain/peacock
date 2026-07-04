import "server-only";
import { getCurrentUser } from "./session";
import { getDashboard } from "./dashboard";
import { getMembers, getMemberDetail, memberDetailContext } from "./members";
import { getLoans, getLoanStats, getCurrentRate } from "./loans";
import { getVendors, getVendorStats } from "./vendors";

// The Share posters reuse the real page components, so this returns exactly what those pages
// fetch — no reshaping. Filtering (active/closed) happens client-side from the include toggles.
export interface ShareData {
  dashboard: Awaited<ReturnType<typeof getDashboard>>;
  members: Awaited<ReturnType<typeof getMembers>>;
  loans: Awaited<ReturnType<typeof getLoans>>;
  loanStats: Awaited<ReturnType<typeof getLoanStats>>;
  rate: string;
  vendors: Awaited<ReturnType<typeof getVendors>>;
  vendorStats: Awaited<ReturnType<typeof getVendorStats>>;
  details: NonNullable<Awaited<ReturnType<typeof getMemberDetail>>>[];
  defaultMemberId: string | null;
  generatedBy: string;
}

export async function getShareData(): Promise<ShareData> {
  const [dashboard, members, loans, loanStats, rate, vendors, vendorStats, me] = await Promise.all([
    getDashboard(), getMembers(), getLoans(), getLoanStats(), getCurrentRate(), getVendors(), getVendorStats(), getCurrentUser(),
  ]);
  // Full member-detail statements (single-member poster) — same query the member page uses, but the
  // club-wide invariants (pooled profit, treasurer options, active count, config) are computed ONCE
  // and injected so every statement reuses them instead of recomputing them per member.
  const ctx = await memberDetailContext();
  const details = (await Promise.all(members.map((m) => getMemberDetail(m.id, ctx)))).filter(
    (d): d is NonNullable<typeof d> => !!d,
  );
  return {
    dashboard, members, loans, loanStats, rate, vendors, vendorStats, details,
    defaultMemberId: me?.id ?? members[0]?.id ?? null,
    generatedBy: me?.name ?? "Peacock admin",
  };
}
