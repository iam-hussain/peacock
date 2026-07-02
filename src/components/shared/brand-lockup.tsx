import Link from "next/link";
import { cn } from "@/lib/utils";
import { PeacockMark } from "./peacock-logo";

/** Horizontal brand lockup: peacock mark + "peacock•" wordmark. Optionally links somewhere. */
export function BrandLockup({
  markPx = 42,
  wordSize = 21,
  href,
  className,
}: {
  markPx?: number;
  wordSize?: number;
  href?: string;
  className?: string;
}) {
  const dot = Math.max(5, Math.round(wordSize / 3));
  const inner = (
    <div className={cn("flex items-center gap-[11px]", className)}>
      <PeacockMark px={markPx} biasY={54} />
      <div className="flex items-end gap-1">
        <span
          className="font-display font-extrabold leading-[0.9] tracking-[-0.03em] text-ink"
          style={{ fontSize: wordSize }}
        >
          peacock
        </span>
        <span
          className="rounded-full bg-teal"
          style={{ width: dot, height: dot, marginBottom: Math.max(2, Math.round(dot / 2.3)) }}
        />
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="flex-none">
      {inner}
    </Link>
  ) : (
    inner
  );
}
