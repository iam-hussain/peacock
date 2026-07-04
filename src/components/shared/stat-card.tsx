import { cn } from "@/lib/utils";

/** Compact KPI tile: uppercase label, mono value, muted sub-line. Used across the app. */
const TONE: Record<string, string> = {
  ink: "text-ink",
  teal: "text-teal",
  in: "text-in",
  out: "text-out",
  warn: "text-wfg",
};

export function StatCard({
  label,
  value,
  sub,
  inlineNote,
  accent = false,
  tone,
  compact = false,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  inlineNote?: string; // small muted note beside the value (e.g. "2 loans")
  accent?: boolean;
  tone?: "ink" | "teal" | "in" | "out" | "warn";
  compact?: boolean;
  className?: string;
}) {
  const valueColor = TONE[tone ?? (accent ? "teal" : "ink")];
  return (
    <div className={cn("border border-hair bg-sf", compact ? "rounded-13 p-3.25" : "rounded-14 p-4", className)}>
      <div
        className={cn(
          "font-semibold uppercase leading-120 tracking-3 text-fnt",
          compact ? "text-9" : "text-10",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "flex items-baseline gap-1.5 font-mono font-semibold leading-none",
          compact ? "mt-2.25 text-17" : "mt-2.75 text-22",
          sub ? (compact ? "mb-1.25" : "mb-1.75") : "",
        )}
      >
        <span className={valueColor}>{value}</span>
        {inlineNote && <span className="font-sans text-11 font-medium text-mut">{inlineNote}</span>}
      </div>
      {sub && (
        <div className={cn("font-semibold leading-none text-mut", compact ? "text-11" : "text-xs")}>{sub}</div>
      )}
    </div>
  );
}
