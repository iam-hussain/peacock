"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Build a compact page list with ellipsis gaps, e.g. [1,"…",4,5,6,"…",12]. */
function pageList(page: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const nums = new Set([1, count, page, page - 1, page + 1]);
  const sorted = [...nums].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

const NAV = "flex size-8 items-center justify-center rounded-lg border border-bd2 text-mut disabled:opacity-40 enabled:hover:bg-sf2";

/** Reusable ‹ Prev · numbered pills · Next › pager. Purely presentational — parent owns page state. */
export function Pager({
  page,
  pageCount,
  onChange,
  className,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  const pages = pageList(page, Math.max(pageCount, 1));
  return (
    <nav className={cn("flex items-center gap-1.5", className)} aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className={NAV}
      >
        <ChevronLeft className="size-4" strokeWidth={2.25} />
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-xs font-semibold leading-none text-fnt">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold leading-none",
              p === page ? "border-teal/40 bg-tlsf text-teal" : "border-bd2 text-mut hover:bg-sf2",
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Next page"
        className={NAV}
      >
        <ChevronRight className="size-4" strokeWidth={2.25} />
      </button>
    </nav>
  );
}
