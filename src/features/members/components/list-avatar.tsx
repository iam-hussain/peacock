import { initials } from "@/lib/avatar";

/** Flat muted-grey initials avatar for member list rows (uniform, not per-name colour). */
export function ListAvatar({ name, size = 38 }: { name: string; size?: number }) {
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full bg-nbg font-bold text-nfg"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {initials(name)}
    </div>
  );
}
