import { cn } from "@/lib/utils";
import { PeacockMark } from "./peacock-logo";

/**
 * Animated brand loader — the peacock mark bobs while three feather-dots pulse.
 * Use as a route-transition / Suspense fallback so slow (DB-bound) navigations
 * give immediate visual feedback instead of a frozen screen.
 */
export function BrandLoader({
  label = "Loading",
  className,
  markPx = 60,
}: {
  label?: string;
  className?: string;
  markPx?: number;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex min-h-[60vh] flex-col items-center justify-center gap-6", className)}
    >
      <div className="animate-peacock-bob">
        <PeacockMark px={markPx} biasY={54} />
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="peacock-dots flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-teal" />
          <span className="size-1.5 rounded-full bg-teal" />
          <span className="size-1.5 rounded-full bg-teal" />
        </div>
        <span className="text-[11px] font-bold uppercase leading-none tracking-[0.14em] text-fnt">{label}</span>
      </div>
    </div>
  );
}
