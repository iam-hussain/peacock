// Deterministic avatar identity from a name: initials + a soft on-brand colour pair.
// ponytail: one small named palette (a design-system scale, like chart colours), not scattered literals.
const PALETTE = [
  { bg: "#E6F3F1", fg: "#0E8C82" }, // teal
  { bg: "#FDF1E3", fg: "#B5740E" }, // amber
  { bg: "#E9F5EE", fg: "#15803D" }, // green
  { bg: "#FBEAEA", fg: "#B91C1C" }, // rose
  { bg: "#EEF1F0", fg: "#5C6B68" }, // slate
  { bg: "#ECEAF7", fg: "#6B4FA0" }, // plum
] as const;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function avatarColor(name: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
