import { prisma } from "@/lib/db";

/*
 * The same fixed-window counters as FinTrack (table rate_limits), with keys starting with
 * "admin-". One atomic upsert per check.
 */

export type Rule = { limit: number; windowSeconds: number };

export const RULES = {
  /** Panel sign-in: per IP and per email. */
  loginIp: { limit: 10, windowSeconds: 15 * 60 },
  loginEmail: { limit: 5, windowSeconds: 15 * 60 },
  /** The setup page, per IP: the setup token can't be guessed by brute force. */
  setup: { limit: 5, windowSeconds: 60 * 60 },
  /** Password or 2FA code asked again inside the panel. */
  reauth: { limit: 10, windowSeconds: 15 * 60 },
} satisfies Record<string, Rule>;

export async function rateLimit(key: string, rule: Rule) {
  const rows = await prisma.$queryRaw<{ count: number; window_start: Date }[]>`
    INSERT INTO "rate_limits" ("key", "window_start", "count")
    VALUES (${`admin-${key}`}, now(), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limits"."window_start" <= now() - make_interval(secs => ${rule.windowSeconds})
        THEN 1 ELSE "rate_limits"."count" + 1 END,
      "window_start" = CASE
        WHEN "rate_limits"."window_start" <= now() - make_interval(secs => ${rule.windowSeconds})
        THEN now() ELSE "rate_limits"."window_start" END
    RETURNING "count", "window_start"`;
  const { count, window_start } = rows[0];
  const retryAfterMs = Math.max(0, window_start.getTime() + rule.windowSeconds * 1000 - Date.now());
  return { ok: count <= rule.limit, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
}

export function waitText(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes === 1 ? "un minuto" : `${minutes} minuti`;
}
