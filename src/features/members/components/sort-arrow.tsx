import { ChevronsUpDown, ArrowDown } from "lucide-react";

/** Sort indicator for a sortable table column header. */
export function SortArrow({ sort }: { sort: "updown" | "down" | "none" }) {
  if (sort === "none") return null;
  if (sort === "down") return <ArrowDown className="size-3 text-teal" strokeWidth={2.5} />;
  return <ChevronsUpDown className="size-3 text-fnt" strokeWidth={2} />;
}
