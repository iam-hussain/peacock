"use client";

import { isoDate } from "@/lib/date";

export type Bucket = "catchup" | "penalty";

export const today = () => isoDate();

export function Trigger({ onOpen, className, ariaLabel, children }: { onOpen: () => void; className: string; ariaLabel?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onOpen} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
