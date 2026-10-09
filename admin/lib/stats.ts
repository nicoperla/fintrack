import { prisma } from "@/lib/db";
import { romeDay } from "@/lib/format";

const DAY = 86_400_000;

/** The numbers of the overview page, in one round of queries. */
export async function overview(now = new Date()) {
  const since = (days: number) => new Date(now.getTime() - days * DAY);
  const [
    users,
    today,
    week,
    month,
    verified,
    twoFactor,
    suspended,
    pro,
    gifts,
    pastDue,
    cancelling,
    households,
    transactions,
    claims,
    active7,
    active30,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: startOfRomeDay(now) } } }),
    prisma.user.count({ where: { createdAt: { gte: since(7) } } }),
    prisma.user.count({ where: { createdAt: { gte: since(30) } } }),
    prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
    prisma.user.count({ where: { twoFactorEnabledAt: { not: null } } }),
    prisma.user.count({ where: { suspendedAt: { not: null } } }),
    prisma.user.count({ where: { plan: "PRO", subscriptionStatus: { not: "comp" } } }),
    prisma.user.count({ where: { subscriptionStatus: "comp" } }),
    prisma.user.count({ where: { subscriptionStatus: "past_due" } }),
    prisma.user.count({ where: { plan: "PRO", planCancelsAtEnd: true } }),
    prisma.household.count(),
    prisma.transaction.count(),
    prisma.claim.count(),
    activeUsers(since(7)),
    activeUsers(since(30)),
  ]);
  return {
    users,
    signups: { today, week, month },
    verified,
    twoFactor,
    suspended,
    pro,
    gifts,
    pastDue,
    cancelling,
    households,
    transactions,
    claims,
    active7,
    active30,
  };
}

/** Accounts that signed in since a date (FinTrack notes each browser's last sign-in). */
async function activeUsers(since: Date) {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT "user_id") AS count FROM "known_devices" WHERE "last_login_at" >= ${since}`;
  return Number(rows[0]?.count ?? 0);
}

export function startOfRomeDay(now: Date) {
  const day = romeDay(now);
  // Rome is UTC+2 in summer and UTC+1 in winter: midnight there is 22:00 or 23:00 UTC.
  for (const offsetHours of [2, 1]) {
    const candidate = new Date(Date.parse(`${day}T00:00:00Z`) - offsetHours * 3_600_000);
    if (romeDay(candidate) === day) return candidate;
  }
  return new Date(`${day}T00:00:00Z`);
}

/** Sign-ups per day (Rome time) over the last `days` days, oldest first, zeros included. */
export async function signupsByDay(days = 30, now = new Date()) {
  const from = new Date(now.getTime() - days * DAY);
  const rows = await prisma.user.findMany({
    where: { createdAt: { gte: from } },
    select: { createdAt: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(romeDay(row.createdAt), (counts.get(romeDay(row.createdAt)) ?? 0) + 1);
  return Array.from({ length: days }, (_, i) => {
    const day = romeDay(new Date(now.getTime() - (days - 1 - i) * DAY));
    return { day, value: counts.get(day) ?? 0 };
  });
}
