import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The design uses px-exact named font-size tokens (text-10, text-13, …) defined in
// globals.css. tailwind-merge doesn't know these are font sizes, so it lumps them
// with our custom text-<color> utilities (text-ink, text-wfg, text-teal) and drops
// the size when both are merged via cn() — leaving badges/chips with no font-size.
// Register the tokens in the font-size group so size and color no longer collide.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "8", "9", "10", "11", "12", "13", "15", "17", "19", "21", "22", "25",
            "26", "28", "30", "32", "38",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
