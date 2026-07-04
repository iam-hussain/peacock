"use client"; // renderable inside the client-side Share poster (props stay serializable DTOs)

import Link from "next/link";
import { AdminOnly } from "@/lib/admin";
import { useInPoster } from "@/lib/poster";
import { CatchupPenaltyCard } from "./catchup-penalty-card";
import { EditMemberButton, SettleButton } from "./member-action-buttons";
import { IdentityCard } from "./identity-card";
import { BalancesCard } from "./balances-card";
import { RejoinCard } from "./rejoin-card";
import { SettlementGuideCard } from "./settlement-guide-card";
import { ContributionCard } from "./contribution-card";
import { LoansCard } from "./loans-card";
import type { MemberDetailDTO as MemberDetail } from "@/server/queries/members";

export function MemberDetailView({ m }: { m: MemberDetail }) {
  const inPoster = useInPoster();
  return (
    <>
      {/* Desktop (forced in the poster regardless of viewport) */}
      <div className={inPoster ? undefined : "hidden md:block"}>
        <div className="mx-auto max-w-320 p-6.5">
          {!inPoster && (
            <Link href="/members" className="mb-4 inline-block text-13 font-semibold leading-none text-teal">
              ← All members
            </Link>
          )}
          {inPoster ? (
            // Poster: one stacked column instead of the sticky-rail two-column layout.
            <div className="flex flex-col gap-4">
              <IdentityCard m={m} />
              <BalancesCard m={m} />
              {m.rejoin && <RejoinCard m={m} />}
              {m.settledGuide && <SettlementGuideCard m={m} />}
              <ContributionCard m={m} />
              <CatchupPenaltyCard m={m} />
              <LoansCard m={m} />
            </div>
          ) : (
            <div className="grid grid-cols-[330px_1fr] items-start gap-4.5">
              {/* left rail */}
              <div className="sticky top-6.5 flex flex-col gap-3.5">
                <IdentityCard m={m} />
                <BalancesCard m={m} />
                <AdminOnly>
                  <div className="flex flex-col gap-2.25">
                    <EditMemberButton m={m} />
                    <SettleButton m={m} />
                  </div>
                </AdminOnly>
              </div>
              {/* right */}
              <div className="flex flex-col gap-4">
                {m.rejoin && <RejoinCard m={m} />}
                {m.settledGuide && <SettlementGuideCard m={m} />}
                <ContributionCard m={m} />
                <CatchupPenaltyCard m={m} />
                <LoansCard m={m} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile (never in the poster — it always uses the desktop layout) */}
      {!inPoster && (
      <div className="pb-19.5 md:hidden">
        <div className="flex flex-col gap-3 p-4">
          <Link href="/members" className="text-13 font-semibold leading-none text-teal">
            ← All members
          </Link>
          <IdentityCard m={m} />
          <AdminOnly>
            <div className="flex gap-2">
              <EditMemberButton m={m} compact={!!m.settle} />
              <SettleButton m={m} compact />
            </div>
          </AdminOnly>
          <BalancesCard m={m} />
          {m.rejoin && <RejoinCard m={m} />}
          {m.settledGuide && <SettlementGuideCard m={m} />}
          <ContributionCard m={m} />
          <CatchupPenaltyCard m={m} />
          <LoansCard m={m} />
        </div>
      </div>
      )}
    </>
  );
}
