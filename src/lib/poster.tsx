"use client";

import { createContext, useContext } from "react";

// True when a page/list component is being rendered inside the Share poster (a static image).
// Components read this to drop interactive chrome — search, filters, tabs, pagers, toggles,
// nav links — that shouldn't appear in an exported PNG. Combine with <AdminProvider isAdmin={false}>
// to also hide admin action buttons.
const PosterContext = createContext(false);

export function PosterProvider({ children }: { children: React.ReactNode }) {
  return <PosterContext.Provider value={true}>{children}</PosterContext.Provider>;
}

export const useInPoster = () => useContext(PosterContext);
