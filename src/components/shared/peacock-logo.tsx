import { cn } from "@/lib/utils";

// ponytail: the mark is intrinsic brand geometry (fixed div-art from the design), sized by `px`.
// Only the three brand colours are tokenised; the px geometry is the logo's actual shape.
const GOLD_LT = "#F4C430";
const GOLD_DK = "#D9A521";
const EYE_PUPIL = "#14201E"; // fixed dark — eyes are always white, so the pupil must stay dark in any theme

/**
 * The peacock mark — a 3-feather fan over a rounded body. Natural art box is 88×104.
 * `biasY` nudges the art vertically within its box (percent); the body sits low, so a value
 * above 50 raises it to visually centre against adjacent text (the design uses 54 in the header).
 */
export function PeacockMark({
  px = 42,
  biasY = 50,
  className,
  onDark = false,
}: {
  px?: number;
  biasY?: number;
  className?: string;
  onDark?: boolean; // side feathers turn white for dark backgrounds (poster headers)
}) {
  const scale = px / 104;
  const side = onDark ? "bg-white" : "bg-ink";
  return (
    <div
      className={cn("relative flex-none", className)}
      style={{ width: 88 * scale, height: px }}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{ transform: `translate(-50%,-${biasY}%) scale(${scale})`, width: 88, height: 104 }}
      >
        {/* left feather */}
        <Feather rotate={-26} stem={26} className={side} />
        {/* center feather */}
        <Feather rotate={0} stem={34} className="bg-teal" />
        {/* right feather */}
        <Feather rotate={26} stem={26} className={side} />
        {/* body */}
        <div
          className="absolute left-1/2 bottom-0 -translate-x-1/2 bg-teal"
          style={{ width: 54, height: 56, borderRadius: "50% 50% 50% 50% / 56% 56% 44% 44%" }}
        >
          <Eye left={12} />
          <Eye left={28} />
          {/* beak */}
          <div className="absolute" style={{ left: 20, top: 36, width: 14, height: 14 }}>
            <div className="absolute inset-0" style={{ background: GOLD_LT, clipPath: "polygon(0 0,50% 0,50% 100%)" }} />
            <div className="absolute inset-0" style={{ background: GOLD_DK, clipPath: "polygon(50% 0,100% 0,50% 100%)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Feather({ rotate, stem, className }: { rotate: number; stem: number; className: string }) {
  return (
    <div
      className="absolute left-1/2 bottom-9 flex flex-col items-center gap-1"
      style={{ transformOrigin: "bottom center", transform: `translateX(-50%) rotate(${rotate}deg)` }}
    >
      <div className={cn("rounded-full", className)} style={{ width: 11, height: 11 }} />
      <div className={cn("rounded-[3px]", className)} style={{ width: 4, height: stem }} />
    </div>
  );
}

function Eye({ left }: { left: number }) {
  return (
    <div
      className="absolute flex items-center justify-center rounded-full bg-white"
      style={{ left, top: 19, width: 14, height: 14 }}
    >
      <div className="rounded-full" style={{ width: 6, height: 6, marginTop: -3, background: EYE_PUPIL }} />
    </div>
  );
}

/** Wordmark "peacock•" — Bricolage display type with the teal dot. `size` is the cap px. */
export function PeacockWordmark({
  size = 21,
  className,
  tagline = false,
}: {
  size?: number;
  className?: string;
  tagline?: boolean;
}) {
  const dot = Math.round(size / 3);
  return (
    <div className={cn("text-center", className)}>
      <div className="flex items-end justify-center" style={{ gap: Math.max(4, dot / 2) }}>
        <span
          className="font-display font-extrabold text-ink"
          style={{ fontSize: size, lineHeight: 0.85, letterSpacing: "-0.03em" }}
        >
          peacock
        </span>
        <span
          className="rounded-full bg-teal"
          style={{ width: dot, height: dot, marginBottom: Math.max(2, dot / 3) }}
        />
      </div>
      {tagline && (
        <div
          className="font-semibold text-mut"
          style={{ fontSize: 11, lineHeight: 1, letterSpacing: "0.06em", marginTop: 7 }}
        >
          investment club
        </div>
      )}
    </div>
  );
}

/** Stacked mark + wordmark + tagline, as used on the landing / login hero. */
export function PeacockLockup({ markPx = 80, wordSize = 32 }: { markPx?: number; wordSize?: number }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <PeacockMark px={markPx} />
      <PeacockWordmark size={wordSize} tagline />
    </div>
  );
}
