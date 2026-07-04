import Link from "next/link";

/** Sticky mobile header: back arrow + title. Reused across public and app detail screens. */
export function MobileBackHeader({ title, backHref = "/" }: { title: string; backHref?: string }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-hair bg-sf px-4.5 py-4">
      <Link href={backHref} className="text-lg font-bold leading-none text-mut">
        ←
      </Link>
      <span className="text-base font-bold leading-none text-ink">{title}</span>
    </div>
  );
}
