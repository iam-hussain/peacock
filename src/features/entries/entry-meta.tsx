import { DIR_META, VENDOR_INTENTS, type Dir } from "./entry-constants";

export function getPartyMeta(intent: string | null) {
  if (intent === "Funds transfer")
    return { kind: "treasurer" as const, label: "To treasurer (receives)", ph: "No treasurer selected", hint: "Tap to pick who receives the transfer", search: "Search treasurers" };
  if (intent && VENDOR_INTENTS.has(intent))
    return { kind: "vendor" as const, label: "Vendor", ph: "No vendor selected", hint: "Click to choose the vendor", search: "Search any vendor" };
  return { kind: "member" as const, label: "Member", ph: "No member selected", hint: "Click to choose who this entry is for", search: "Search any member" };
}

export function getHolderMeta(dir: Dir) {
  if (dir === "out")
    return { label: "Money comes from (who pays)", desc: "The club has no account of its own. Pick the treasurer paying out the cash.", ph: "No payer selected", hint: "Tap to pick who pays" };
  if (dir === "move")
    return { label: "From treasurer (sends)", desc: "Pick the treasurer sending the cash.", ph: "No sender selected", hint: "Tap to pick the sender" };
  return { label: "Money goes to (who holds it)", desc: "The club has no account of its own — any member can hold its cash. Pick who receives it.", ph: "No holder selected", hint: "Tap to pick who receives the cash" };
}

export function DirBadge({ dir }: { dir: Dir }) {
  const m = DIR_META[dir];
  return <span className={`rounded-md px-2 py-1 text-11 font-bold uppercase leading-none tracking-4 ${m.tile} ${m.color}`}>{m.badge}</span>;
}
