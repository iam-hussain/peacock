"use client";

// Client-side gateway to the server actions: identical signatures, plus React Query invalidation
// after every mutation that didn't explicitly fail. Client components import mutations from HERE,
// never from "@/server/actions" directly — that's what keeps every list/stat on screen live.
import * as A from "@/server/actions";
import { exportBackup, importBackup as importBackupAction } from "@/server/backup";
import { getQueryClient } from "@/lib/query-client";

function invalidating<Args extends unknown[], R>(fn: (...args: Args) => Promise<R>): (...args: Args) => Promise<R> {
  return async (...args: Args) => {
    const res = await fn(...args);
    // ActionResult convention: { ok: false } = nothing changed. Anything else mutated something.
    if ((res as { ok?: boolean } | null | undefined)?.ok !== false) await getQueryClient().invalidateQueries();
    return res;
  };
}

export const formAction = invalidating(A.formAction);
export const decideSubmission = invalidating(A.decideSubmission);
export const markAllRead = invalidating(A.markAllRead);
export const updateAvatar = invalidating(A.updateAvatar);
export const setAdmin = invalidating(A.setAdmin);
export const saveClubSettings = invalidating(A.saveClubSettings);
export const savePenaltyConfig = invalidating(A.savePenaltyConfig);
export const syncAutoPenaltiesNow = invalidating(A.syncAutoPenaltiesNow);
export const closeQuarterNow = invalidating(A.closeQuarterNow);
export const importBackup = invalidating(importBackupAction);

// Reads — passthrough (no cache to invalidate).
export const loadActivity = A.loadActivity;
export { exportBackup };
