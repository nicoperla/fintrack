import { prisma } from "@/lib/db";

/*
 * Who is hammering the sign-in: the rate-limit counters (table rate_limits) of FinTrack and of
 * the panel, read with the same limits the apps apply (lib/rate-limit.ts in both).
 */

type Kind = {
  prefix: string;
  label: string;
  limit: number;
  windowSeconds: number;
  who: "email" | "ip" | "user";
};

export const KINDS: Kind[] = [
  {
    prefix: "admin-login:email:",
    label: "Accesso al pannello",
    limit: 5,
    windowSeconds: 900,
    who: "email",
  },
  {
    prefix: "admin-login:ip:",
    label: "Accesso al pannello",
    limit: 10,
    windowSeconds: 900,
    who: "ip",
  },
  {
    prefix: "admin-setup:ip:",
    label: "Setup del pannello",
    limit: 5,
    windowSeconds: 3600,
    who: "ip",
  },
  { prefix: "login:email:", label: "Accesso", limit: 8, windowSeconds: 900, who: "email" },
  { prefix: "login:ip:", label: "Accesso", limit: 30, windowSeconds: 900, who: "ip" },
  {
    prefix: "2fa-day:",
    label: "Codici 2FA (giorno)",
    limit: 20,
    windowSeconds: 86_400,
    who: "user",
  },
  { prefix: "2fa:", label: "Codici 2FA", limit: 5, windowSeconds: 900, who: "user" },
  {
    prefix: "reauth:",
    label: "Password nelle impostazioni",
    limit: 10,
    windowSeconds: 900,
    who: "user",
  },
  { prefix: "register:ip:", label: "Registrazione", limit: 5, windowSeconds: 3600, who: "ip" },
  { prefix: "reset:email:", label: "Reset password", limit: 3, windowSeconds: 3600, who: "email" },
  { prefix: "reset:ip:", label: "Reset password", limit: 10, windowSeconds: 3600, who: "ip" },
];

export type Attempt = {
  key: string;
  label: string;
  who: string;
  whoKind: Kind["who"];
  userId: string | null;
  count: number;
  limit: number;
  blocked: boolean;
  until: Date;
};

export function classify(
  row: { key: string; count: number; window_start: Date },
  now = Date.now(),
): Attempt | null {
  const kind = KINDS.find((k) => row.key.startsWith(k.prefix));
  if (!kind) return null;
  const until = new Date(row.window_start.getTime() + kind.windowSeconds * 1000);
  if (until.getTime() <= now) return null;
  const who = row.key.slice(kind.prefix.length);
  return {
    key: row.key,
    label: kind.label,
    who,
    whoKind: kind.who,
    userId: kind.who === "user" ? who : null,
    count: row.count,
    limit: kind.limit,
    blocked: row.count > kind.limit,
    until,
  };
}

/** Counters still in their window with at least half the allowed tries used. */
export async function suspiciousAttempts(now = Date.now()) {
  const rows = await prisma.$queryRaw<{ key: string; count: number; window_start: Date }[]>`
    SELECT "key", "count", "window_start" FROM "rate_limits"
    WHERE "window_start" > now() - interval '1 day' AND "count" >= 3
    ORDER BY "count" DESC LIMIT 200`;
  return rows
    .map((row) => classify(row, now))
    .filter((a): a is Attempt => a !== null && a.count * 2 >= a.limit)
    .sort((a, b) => Number(b.blocked) - Number(a.blocked) || b.count - a.count);
}
