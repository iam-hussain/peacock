import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* Shared, presentational building blocks for the "How Peacock works" guide.
   Everything is token-driven (no literals), works in light/dark, and scales
   from mobile to desktop. Kept deliberately small and composable. */

/** Small uppercase kicker above a heading. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-11 font-semibold uppercase leading-none tracking-12 text-teal">
      {children}
    </div>
  );
}

/** The heading block at the top of each tab panel. */
export function PanelHeading({
  icon: Icon,
  kicker,
  title,
  intro,
}: {
  icon: LucideIcon;
  kicker: string;
  title: string;
  intro: string;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <div className="flex size-11 flex-none items-center justify-center rounded-13 bg-tlsf md:size-12">
        <Icon className="size-5.5 text-teal md:size-6" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <Eyebrow>{kicker}</Eyebrow>
        <h2 className="mt-2 font-display text-22 font-extrabold leading-110 tracking-[-0.02em] text-ink md:text-28">
          {title}
        </h2>
        <p className="mt-2 max-w-160 text-13 font-medium leading-160 text-mut md:text-15">{intro}</p>
      </div>
    </div>
  );
}

/** A titled content card (the default surface used throughout the guide). */
export function Card({
  title,
  icon: Icon,
  children,
  className,
}: {
  title?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-hair bg-sf p-4.5 md:p-5.5", className)}>
      {title && (
        <div className="mb-3 flex items-center gap-2.5">
          {Icon && (
            <span className="flex size-7 flex-none items-center justify-center rounded-8 bg-tlsf">
              <Icon className="size-4 text-teal" strokeWidth={2.2} />
            </span>
          )}
          <h3 className="text-15 font-bold leading-120 text-ink md:text-17">{title}</h3>
        </div>
      )}
      {children}
    </section>
  );
}

/** A compact rule/feature tile (icon + label + one line). */
export function RuleTile({
  icon: Icon,
  label,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-14 border border-hair bg-sf2 p-3.5">
      <span className="flex size-8 flex-none items-center justify-center rounded-9 bg-tlsf">
        <Icon className="size-4.25 text-teal" strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <div className="text-13 font-bold leading-120 text-ink">{label}</div>
        <div className="mt-1 text-xs font-medium leading-145 text-mut">{detail}</div>
      </div>
    </div>
  );
}

/** A big number tile (facts strip). */
export function StatTile({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="rounded-14 border border-hair bg-sf p-3.5 md:p-4.5">
      <div className="font-mono text-21 font-semibold leading-none text-teal md:text-25">{value}</div>
      <div className="mt-2 text-xs font-semibold leading-130 text-ink md:mt-2.25">{label}</div>
      {sub && <div className="mt-1 text-10 font-medium leading-140 text-fnt md:text-11">{sub}</div>}
    </div>
  );
}

type CalloutTone = "teal" | "warn" | "neutral";
const CALLOUT: Record<CalloutTone, string> = {
  teal: "border-tlsf bg-tlsf/60 text-teal",
  warn: "border-wbd bg-wbg text-wfg",
  neutral: "border-hair bg-sf2 text-mut",
};

/** An emphasis note. Body text stays readable (ink); the tone colours the frame + icon. */
export function Callout({
  icon: Icon,
  title,
  tone = "teal",
  children,
}: {
  icon: LucideIcon;
  title?: string;
  tone?: CalloutTone;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-start gap-3 rounded-14 border p-3.5 md:p-4", CALLOUT[tone])}>
      <Icon className="mt-0.25 size-4.5 flex-none" strokeWidth={2.2} />
      <div className="min-w-0">
        {title && <div className="text-13 font-bold leading-120">{title}</div>}
        <div className={cn("text-xs font-medium leading-160 text-ink md:text-13", title && "mt-1")}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Direction chip — matches the app's green-in / red-out convention. */
export function FlowChip({ dir }: { dir: "in" | "out" | "neutral" }) {
  const map = {
    in: { c: "bg-[color:var(--in)]/12 text-in", t: "Money in" },
    out: { c: "bg-[color:var(--out)]/12 text-out", t: "Money out" },
    neutral: { c: "bg-nbg text-nfg", t: "Neutral" },
  } as const;
  const { c, t } = map[dir];
  return (
    <span className={cn("rounded-full px-2.25 py-1 text-10 font-bold uppercase leading-none tracking-4", c)}>
      {t}
    </span>
  );
}

/** One row of a step-by-step worked example: a running ledger line. */
export function LedgerRow({
  label,
  hint,
  value,
  tone = "ink",
  emphasize = false,
}: {
  label: string;
  hint?: string;
  value: string;
  tone?: "ink" | "in" | "out" | "teal";
  emphasize?: boolean;
}) {
  const valueTone = {
    ink: "text-ink",
    in: "text-in",
    out: "text-out",
    teal: "text-teal",
  }[tone];
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3.5 py-3 md:px-4.5",
        emphasize ? "bg-tlsf/50" : "",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className={cn("text-13 leading-120 text-ink", emphasize ? "font-bold" : "font-semibold")}>
          {label}
        </div>
        {hint && <div className="mt-0.75 text-11 font-medium leading-140 text-mut">{hint}</div>}
      </div>
      <div
        className={cn(
          "flex-none font-mono text-13 font-semibold leading-none md:text-15",
          valueTone,
          emphasize && "text-15 md:text-17",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/** A framed running-ledger built from LedgerRows (dividers auto-applied). */
export function Ledger({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-hr2 overflow-hidden rounded-14 border border-hair bg-sf">
      {children}
    </div>
  );
}
