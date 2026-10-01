import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";

/*
 * Fixed-window rate limiting stored in Postgres: serverless functions share no memory, and the
 * app has no Redis. One atomic upsert per check.
 */

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

export type RateLimitRule = { limit: number; windowSeconds: number };

export const RULES = {
  /** Per email and per IP: slows down password guessing without locking anyone out for long. */
  loginEmail: { limit: 8, windowSeconds: 15 * 60 },
  loginIp: { limit: 30, windowSeconds: 15 * 60 },
  register: { limit: 5, windowSeconds: 60 * 60 },
  resetEmail: { limit: 3, windowSeconds: 60 * 60 },
  resetIp: { limit: 10, windowSeconds: 60 * 60 },
  resetSubmit: { limit: 10, windowSeconds: 60 * 60 },
  verifyResend: { limit: 3, windowSeconds: 60 * 60 },
  invites: { limit: 20, windowSeconds: 24 * 60 * 60 },
  /** Coach chat, per user: a burst limit and a daily allowance. */
  coachBurst: { limit: 5, windowSeconds: 60 },
  coachDaily: {
    limit: Number(process.env.COACH_DAILY_LIMIT) || 30,
    windowSeconds: 24 * 60 * 60,
  },
} satisfies Record<string, RateLimitRule>;

export async function rateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const windowMs = rule.windowSeconds * 1000;
  const rows = await prisma.$queryRaw<{ count: number; window_start: Date }[]>`
    INSERT INTO "rate_limits" ("key", "window_start", "count")
    VALUES (${key}, now(), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limits"."window_start" <= now() - make_interval(secs => ${rule.windowSeconds})
        THEN 1 ELSE "rate_limits"."count" + 1 END,
      "window_start" = CASE
        WHEN "rate_limits"."window_start" <= now() - make_interval(secs => ${rule.windowSeconds})
        THEN now() ELSE "rate_limits"."window_start" END
    RETURNING "count", "window_start"`;
  const { count, window_start } = rows[0];

  // Now and then, drop counters whose window ended long ago.
  if (Math.random() < 0.01) {
    await prisma.rateLimit
      .deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 2 * 86_400_000) } } })
      .catch(() => {});
  }

  const retryAfterMs = Math.max(0, window_start.getTime() + windowMs - Date.now());
  return {
    ok: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
  };
}

/** Undoes one hit: e.g. a coach question the AI never answered shouldn't use up the quota. */
export async function refundRateLimit(key: string) {
  await prisma.$executeRaw`
    UPDATE "rate_limits" SET "count" = GREATEST(0, "count" - 1) WHERE "key" = ${key}`;
}

/** The caller's IP on Vercel (first hop of x-forwarded-for), or "unknown". */
export function clientIp(source?: Headers | Record<string, string | string[] | undefined>) {
  let forwarded: string | null | undefined;
  if (!source) {
    try {
      forwarded = headers().get("x-forwarded-for") ?? headers().get("x-real-ip");
    } catch {
      forwarded = null;
    }
  } else if (source instanceof Headers) {
    forwarded = source.get("x-forwarded-for") ?? source.get("x-real-ip");
  } else {
    const value = source["x-forwarded-for"] ?? source["x-real-ip"];
    forwarded = Array.isArray(value) ? value[0] : value;
  }
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/** "3 minuti", "1 ora", for messages telling the user how long to wait. */
export function formatRetryAfter(seconds: number) {
  if (seconds < 90) return "un minuto";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minuti`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "un'ora" : `${hours} ore`;
}
