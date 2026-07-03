"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const KEY = "theme";
const listeners = new Set<() => void>();

function current(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Apply a theme to the <html> class, persist it, and notify every useTheme() subscriber. */
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // ponytail: private-mode localStorage throws; theme just won't persist, no upgrade needed.
  }
  listeners.forEach((l) => l());
}

export function toggleTheme() {
  applyTheme(current() === "dark" ? "light" : "dark");
}

/** Reflect and control the active theme (set by the pre-hydration script in the root layout). */
export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    current,
    () => "light" as Theme,
  );
  return [theme, applyTheme];
}
