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
    <div className={cn("border border-hair bg-sf", compact ? "rounded-[13px] p-[13px]" : "rounded-[14px] p-4", className)}>
      <div
        className={cn(
          "font-semibold uppercase leading-[1.2] tracking-[0.03em] text-fnt",
          compact ? "text-[9px]" : "text-[10px]",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "flex items-baseline gap-1.5 font-mono font-semibold leading-none",
          compact ? "mt-[9px] text-[17px]" : "mt-[11px] text-[22px]",
          sub ? (compact ? "mb-[5px]" : "mb-[7px]") : "",
        )}
      >
        <span className={valueColor}>{value}</span>
        {inlineNote && <span className="font-sans text-[11px] font-medium text-mut">{inlineNote}</span>}
      </div>
      {sub && (
        <div className={cn("font-semibold leading-none text-mut", compact ? "text-[11px]" : "text-xs")}>{sub}</div>
      )}
    </div>
  );
}
