"use client";

import { createContext, useContext } from "react";

// Mirrors the server session's isAdmin so client islands can hide admin-only controls
// without prop-drilling. The server actions are the real gate — this is UX only.
const AdminContext = createContext(false);

export function AdminProvider({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  return <AdminContext.Provider value={isAdmin}>{children}</AdminContext.Provider>;
}

export const useIsAdmin = () => useContext(AdminContext);

// Client gate for admin-only controls rendered inside Server Components (which can't read the
// context or the session without deopting SSG). Renders children only for admins.
export function AdminOnly({ children }: { children: React.ReactNode }) {
  return useIsAdmin() ? <>{children}</> : null;
}
