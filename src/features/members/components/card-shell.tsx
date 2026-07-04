// Shared card chrome for the member-detail cards (title + optional badge/right slot).
export function CardShell({ title, titleBadge, right, children }: { title: string; titleBadge?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-18 border border-bd bg-sf shadow-card">
      <div className="flex items-baseline justify-between px-5.5 pt-4.5">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-bold leading-none text-ink">{title}</h2>
          {titleBadge}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}
