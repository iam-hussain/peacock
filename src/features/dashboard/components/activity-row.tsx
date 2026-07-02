import type { Dir } from "../data";

const DOT: Record<Dir, string> = { in: "bg-in", out: "bg-out", neutral: "bg-fnt" };
const AMT: Record<Dir, string> = { in: "text-in", out: "text-out", neutral: "text-mut" };

export function ActivityRow({
  who,
  what,
  time,
  amt,
  dir,
  compact = false,
}: {
  who: string;
  what: string;
  time: string;
  amt: string;
  dir: Dir;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center gap-[11px] border-t border-hair ${compact ? "gap-[9px] py-2.5" : "py-[11px]"}`}>
      <span className={`flex-none rounded-full ${DOT[dir]} ${compact ? "size-[7px]" : "size-2"}`} />
      <div className="min-w-0 flex-1">
        <div className={`font-semibold leading-none text-ink ${compact ? "text-[13px]" : "text-[13px]"}`}>{who}</div>
        <div className={`mt-1 font-medium leading-[1.3] text-fnt ${compact ? "text-[11px]" : "text-[11px]"}`}>
          {time ? `${what} · ${time}` : what}
        </div>
      </div>
      <div className={`font-mono font-semibold leading-none ${AMT[dir]} ${compact ? "text-[13px]" : "text-[13px]"}`}>
        {amt}
      </div>
    </div>
  );
}
