import { cn } from "@/lib/utils";
import { initials, avatarColor } from "@/lib/avatar";

/** Round avatar: the member's photo when `src` is set, else name-derived (or muted-grey) initials. */
export function Avatar({
  name,
  src,
  size = 38,
  className,
  muted = false,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
  muted?: boolean;
}) {
  const { bg, fg } = avatarColor(name);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- inline base64 avatar, no image domain config
      <img
        src={src}
        alt=""
        className={cn("flex-none rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={cn("flex flex-none items-center justify-center rounded-full font-bold", muted && "bg-nbg text-nfg", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34), ...(muted ? {} : { background: bg, color: fg }) }}
    >
      {initials(name)}
    </div>
  );
}
