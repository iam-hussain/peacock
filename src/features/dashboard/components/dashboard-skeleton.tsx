// Dashboard-shaped loading fallback: token-based pulse blocks that mirror the real layout, so the
// page shell streams instantly and the heavy (DB-bound) dashboard data fills in without a jump.
function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-bg2 ${className}`} />;
}

function TileSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-14 border border-hair bg-sf p-4 ${className}`}>
      <Block className="h-3 w-20" />
      <Block className="mt-3 h-6 w-24" />
      <Block className="mt-2.5 h-2.5 w-16" />
    </div>
  );
}

function GroupSkeleton() {
  return (
    <div className="rounded-14 border border-hair bg-sf p-4">
      <Block className="mb-3 h-2.5 w-20" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between border-t border-hr2 py-2">
          <Block className="h-2.5 w-24" />
          <Block className="h-2.5 w-14" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      {/* Desktop */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-320 p-6.5">
          <Block className="h-7 w-64" />
          <Block className="mt-2 h-3.5 w-40" />

          <div className="mb-4 mt-5 grid grid-cols-5 gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <TileSkeleton key={i} />
            ))}
          </div>

          <div className="grid grid-cols-[1.5fr_1fr] gap-4">
            <div className="flex flex-col gap-4">
              <div className="rounded-14 border border-hair bg-sf p-4.5">
                <Block className="h-3.5 w-28" />
                <Block className="mt-4 h-[150px] w-full" />
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                {[0, 1, 2, 3].map((i) => (
                  <GroupSkeleton key={i} />
                ))}
              </div>
            </div>
            <div className="rounded-14 border border-hair bg-sf p-4.5">
              <Block className="mb-4 h-3.5 w-32" />
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between border-t border-hr2 py-3">
                  <Block className="h-3 w-32" />
                  <Block className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="pb-19.5 md:hidden">
        <div className="px-4 pb-0.5 pt-4">
          <Block className="h-6 w-48" />
          <Block className="mt-2 h-3 w-36" />
        </div>
        <div className="flex flex-col gap-3 px-4 py-3.5">
          <Block className="h-[104px] w-full rounded-18" />
          <div className="grid grid-cols-2 gap-2.5">
            <TileSkeleton />
            <TileSkeleton />
          </div>
          <div className="rounded-14 border border-hair bg-sf p-3.75">
            <Block className="h-3 w-24" />
            <Block className="mt-3 h-[120px] w-full" />
          </div>
          <GroupSkeleton />
          <GroupSkeleton />
        </div>
      </div>
    </div>
  );
}
