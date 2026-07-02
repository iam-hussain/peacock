import { cn } from "@/lib/utils";

export type Status = "active" | "inactive" | "left" | "settled";

const STYLES: Record<Status, string> = {
  active: "bg-tlsf text-teal",
  inactive: "bg-wbg text-wfg",
  left: "bg-nbg text-nfg",
  settled: "bg-wbg text-wfg",
};

const LABELS: Record<Status, string> = {
  active: "Active",
  inactive: "Inactive",
  left: "Left",
  settled: "Settled",
};

/** Rounded pill status chip (Active / Inactive / Left / Settled). */
export function StatusBadge({ status, label, className }: { status: Status; label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[20px] px-[9px] py-1 text-[10px] font-semibold uppercase leading-none tracking-[0.03em]",
        STYLES[status],
        className,
      )}
    >
      {label ?? LABELS[status]}
    </span>
  );
}
