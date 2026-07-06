"use client";

import { useEffect } from "react";

/** Run `fn(vv)` now and on every visual-viewport resize/scroll. iOS WebKit pans/shrinks the
 * visual viewport for the keyboard (and leaves it stale after dismissal) without moving the
 * layout viewport that `position: fixed` anchors to — callers use this to re-pin fixed UI.
 * Pass a stable (useCallback) fn; changing it re-subscribes and re-runs. */
export function useVisualViewport(fn: (vv: VisualViewport) => void) {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const run = () => fn(vv);
    run();
    vv.addEventListener("resize", run);
    vv.addEventListener("scroll", run);
    return () => {
      vv.removeEventListener("resize", run);
      vv.removeEventListener("scroll", run);
    };
  }, [fn]);
}
