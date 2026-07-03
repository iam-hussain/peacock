import { cn } from "@/lib/utils";

/** Round user avatar: the member's photo when set, else their initials. Size/colour via className. */
export function UserAvatar({ initials, avatarUrl, className }: { initials: string; avatarUrl?: string | null; className?: string }) {
  return (
    <span className={cn("relative flex flex-none items-center justify-center overflow-hidden rounded-full", className)}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- inline base64 avatar, no image domain config
        <img src={avatarUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}
