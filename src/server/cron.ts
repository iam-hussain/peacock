import "server-only";

/** Vercel cron requests carry `Authorization: Bearer ${CRON_SECRET}`. No secret set (local dev)
 *  → open; set → enforced. */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !secret || req.headers.get("authorization") === `Bearer ${secret}`;
}
