import { initials } from "@/lib/avatar";

/** Member list-row avatar: the member's photo when `src` is set, else flat muted-grey initials. */
export function ListAvatar({ name, src, size = 38 }: { name: string; src?: string | null; size?: number }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- inline base64 avatar, no image domain config
      <img src={src} alt="" className="flex-none rounded-full object-cover" style={{ width: size, height: size }} />
    );
  }
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full bg-nbg font-bold text-nfg"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {initials(name)}
    </div>
  );
}
