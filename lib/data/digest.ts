import { prisma } from "@/lib/db/prisma";
import { getBudgetsWithSpending } from "@/lib/data/budgets";
import { getGamification } from "@/lib/data/gamification";
import { getRecurring } from "@/lib/data/intelligence";
import { claimsToMention, getClaimsOverview } from "@/lib/data/claims";
import { KIND_LABELS } from "@/lib/finance/claims";
import { summarizeByTopCategory } from "@/lib/finance/dashboard-math";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";
import { getAppUrl } from "@/lib/app-url";
import { getActiveSpace } from "@/lib/households";
import { unsubscribeUrl } from "@/lib/reports/unsubscribe";
import { weekRangeLabel, type DigestInput } from "@/lib/reports/digest";

const DAY_MS = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

/** The last complete Monday–Sunday week in Italy, as UTC-midnight dates. */
export function lastCompleteWeek() {
  const t = todayInAppTimeZone();
  const today = utcDate(t.year, t.month, t.day);
  const sinceMonday = (today.getUTCDay() + 6) % 7;
  const start = addDays(today, -sinceMonday - 7);
  return { today, start, end: addDays(start, 7), previousStart: addDays(start, -7) };
}

/** The digest covers the user's active space, in its currency. */
export async function getDigestInput(userId: string): Promise<DigestInput> {
  const space = await getActiveSpace({ id: userId });
  const householdId = space.id;
  const { today, start, end, previousStart } = lastCompleteWeek();
  const types = { in: ["INCOME" as const, "EXPENSE" as const] };

  const [
    user,
    totals,
    previousExpense,
    sums,
    categories,
    budgets,
    recurring,
    gamification,
    claims,
  ] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } }),
    prisma.transaction.groupBy({
      by: ["type"],
      where: { householdId, type: types, date: { gte: start, lt: end } },
      _sum: { baseAmount: true },
      _count: { _all: true },
    }),
    prisma.transaction.aggregate({
      where: { householdId, type: "EXPENSE", date: { gte: previousStart, lt: start } },
      _sum: { baseAmount: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { householdId, type: "EXPENSE", date: { gte: start, lt: end } },
      _sum: { baseAmount: true },
    }),
    prisma.category.findMany({
      where: { householdId },
      select: { id: true, name: true, color: true, parentId: true },
    }),
    getBudgetsWithSpending(householdId),
    getRecurring(householdId),
    getGamification(userId, householdId),
    getClaimsOverview(userId, householdId),
  ]);

  const total = (type: string) => Number(totals.find((r) => r.type === type)?._sum.baseAmount ?? 0);
  const todayIso = toDateInputValue(today);
  const weekAhead = toDateInputValue(addDays(today, 7));

  return {
    name: user.name,
    currency: space.currency,
    spaceName: space.spaces.find((s) => s.id === space.id)!.memberCount > 1 ? space.name : null,
    weekLabel: weekRangeLabel(toDateInputValue(start), toDateInputValue(addDays(end, -1))),
    income: total("INCOME"),
    expense: total("EXPENSE"),
    previousExpense: Number(previousExpense._sum.baseAmount ?? 0),
    count: totals.reduce((n, r) => n + r._count._all, 0),
    topCategories: summarizeByTopCategory(
      sums.map((s) => ({ categoryId: s.categoryId, amount: Number(s._sum.baseAmount ?? 0) })),
      categories,
      4,
    )
      .filter((s) => s.id !== null)
      .slice(0, 3)
      .map((s) => ({ name: s.name, value: s.value })),
    budgets: budgets.flatMap((b) =>
      b.status === "ok"
        ? []
        : [{ name: b.categoryName, ratio: b.ratio, status: b.status, remaining: b.remaining }],
    ),
    upcoming: recurring
      .filter(
        (r) => r.active && r.type === "EXPENSE" && r.nextDate >= todayIso && r.nextDate < weekAhead,
      )
      .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
      .slice(0, 5)
      .map((r) => ({ name: r.name, amount: r.lastAmount, date: r.nextDate })),
    claims: claimsToMention(claims.claims, claims.today).map((c) => ({
      id: c.id,
      counterparty: c.counterparty,
      kind: KIND_LABELS[c.kind],
      step: c.step.text,
      urgent: c.step.tone === "urgent",
    })),
    streak: { current: gamification.streak.current, longest: gamification.streak.longest },
    level: { level: gamification.level.level, name: gamification.level.name },
    appUrl: getAppUrl(),
    unsubscribeUrl: unsubscribeUrl(userId),
  };
}
