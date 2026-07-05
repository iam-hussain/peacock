import { forwardRef } from "react";
import { PeacockMark } from "@/components/shared/peacock-logo";
import { AdminProvider } from "@/lib/admin";
import { PosterProvider } from "@/lib/poster";
// The Share feature is a cross-cutting aggregator, so it composes the other features' public
// page views directly (rendered read-only via PosterProvider + AdminProvider isAdmin={false}).
import { Dashboard } from "@/features/dashboard/components/dashboard";
import { MembersTable } from "@/features/members/components/members-table";
import { LoansList } from "@/features/loans/components/loans-list";
import { VendorsList } from "@/features/vendors/components/vendors-list";
import { MemberDetailView } from "@/features/members/components/member-detail";
import type { DashboardData } from "@/server/queries/dashboard";
import type { MemberDetailDTO } from "@/server/queries/members";
import type * as MQ from "@/server/queries/members";
import type * as LQ from "@/server/queries/loans";
import type * as VQ from "@/server/queries/vendors";

export interface ClubSections { club: boolean; members: boolean; loans: boolean; vendors: boolean }

// Assembled client-side from the same endpoints the real pages use (/api/dashboard, /api/members,
// /api/loans, /api/vendors) — there is no dedicated share payload.
export interface ClubData {
  dashboard: DashboardData;
  members: Awaited<ReturnType<typeof MQ.getMembers>>;
  loans: Awaited<ReturnType<typeof LQ.getLoans>>;
  loanStats: Awaited<ReturnType<typeof LQ.getLoanStats>>;
  rate: Awaited<ReturnType<typeof LQ.getCurrentRate>>;
  vendors: Awaited<ReturnType<typeof VQ.getVendors>>;
  vendorStats: Awaited<ReturnType<typeof VQ.getVendorStats>>;
}

// Header/footer are a fixed light brand frame — the poster is always exported light.
function PosterHeader({ title, asOf, subtitle }: { title: string; asOf: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-between border-b border-hair px-14 py-8">
      <div className="flex items-center gap-4">
        <PeacockMark px={58} biasY={54} />
        <div>
          <div className="flex items-end gap-1.75">
            <span className="font-display text-38 font-extrabold leading-90 tracking-[-0.03em] text-ink">peacock</span>
            <span className="mb-1.5 size-2.25 rounded-full bg-teal" />
          </div>
          <div className="mt-2.5 text-sm font-semibold leading-none tracking-5 text-mut">INVESTMENT CLUB</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-13 font-semibold leading-none tracking-14 text-teal">{title}</div>
        <div className="mt-3 text-15 font-medium leading-none text-mut">{asOf}</div>
        <div className="mt-1.5 text-sm font-medium leading-none text-mut">{subtitle}</div>
      </div>
    </div>
  );
}
function PosterFooter() {
  return (
    <div className="flex items-center justify-between border-t border-hair px-14 pb-11 pt-7">
      <div className="flex items-center gap-4">
        <PeacockMark px={40} />
        <div className="flex items-end gap-1.5">
          <span className="font-display text-2xl font-extrabold leading-90 tracking-[-0.03em] text-ink">peacock</span>
          <span className="mb-1 size-1.75 rounded-full bg-teal" />
          <span className="ml-2 text-15 font-semibold leading-none text-teal">Many feathers, one fortune.</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-15 font-semibold leading-none text-ink">Peacock Investment Club</div>
        <div className="mt-2 text-13 font-medium leading-none text-mut">Figures in ₹ · admin snapshot</div>
      </div>
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  // Read-only, non-admin, poster context around the reused page components.
  return (
    <PosterProvider>
      <AdminProvider isAdmin={false}>{children}</AdminProvider>
    </PosterProvider>
  );
}

/* ============================ CLUB REPORT ============================ */
export const ClubReportPoster = forwardRef<HTMLDivElement, { data: ClubData; sections: ClubSections; incInactive: boolean; incClosedLoans: boolean; incClosedVendors: boolean; asOf: string; by: string }>(
  function ClubReportPoster({ data, sections, incInactive, incClosedLoans, incClosedVendors, asOf, by }, ref) {
    const members = incInactive ? data.members : data.members.filter((m) => m.status === "active");
    // Closed off → the loans page's default "Pending" view (open loans + closed still owing interest).
    const loans = incClosedLoans ? data.loans : data.loans.filter((l) => l.pendingInterest);
    const vendors = incClosedVendors ? data.vendors : data.vendors.filter((v) => v.status === "active");
    return (
      <div ref={ref} style={{ width: 1280 }} className="poster-light overflow-hidden rounded-lg bg-bg">
        <PosterHeader title="CLUB REPORT" asOf={asOf} subtitle={by} />
        <Frame>
          {sections.club && <Dashboard data={data.dashboard} greeting={{ hello: "", sub: "" }} />}
          {sections.members && (
            <div className="mx-auto max-w-320 px-6.5 pb-2 pt-1">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-xl font-bold leading-none tracking-[-0.02em] text-ink">Members</h2>
                <span className="text-13 font-medium leading-none text-fnt">{incInactive ? `${members.length} members · incl. inactive` : `${members.length} active members`}</span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-card">
                <MembersTable members={members} />
              </div>
            </div>
          )}
          {sections.loans && <LoansList loans={loans} stats={data.loanStats} rate={data.rate} eligibility={[]} />}
          {sections.vendors && <VendorsList vendors={vendors} stats={data.vendorStats} />}
        </Frame>
        <PosterFooter />
      </div>
    );
  },
);

/* ============================ MEMBER STATEMENT ============================ */
export const MemberStatementPoster = forwardRef<HTMLDivElement, { detail: MemberDetailDTO; asOf: string; by: string }>(
  function MemberStatementPoster({ detail, asOf, by }, ref) {
    return (
      <div ref={ref} style={{ width: 900 }} className="poster-light overflow-hidden rounded-lg bg-bg">
        <PosterHeader title="MEMBER STATEMENT" asOf={asOf} subtitle={by} />
        <Frame>
          <MemberDetailView m={detail} />
        </Frame>
        <PosterFooter />
      </div>
    );
  },
);
