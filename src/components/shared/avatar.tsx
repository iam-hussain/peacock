import { cn } from "@/lib/utils";
import { initials, avatarColor } from "@/lib/avatar";

/** Round initials avatar. Colour is name-derived, or a flat muted grey when `muted`. */
export function Avatar({
  name,
  size = 38,
  className,
  muted = false,
}: {
  name: string;
  size?: number;
  className?: string;
  muted?: boolean;
}) {
  const { bg, fg } = avatarColor(name);
  return (
    <div
      className={cn("flex flex-none items-center justify-center rounded-full font-bold", muted && "bg-nbg text-nfg", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34), ...(muted ? {} : { background: bg, color: fg }) }}
    >
      {initials(name)}
    </div>
  );
}
