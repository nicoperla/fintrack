import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { computeGamification } from "@/lib/gamification/engine";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

/**
 * Habits (streak, movements recorded, imports) are personal: they count what the user recorded,
 * in any space. Achievements about money (budgets, goals, savings) belong to the current space.
 * Deduplicated per request: the layout badge and the page share one computation.
 */
export const getGamification = cache(async (userId: string, householdId: string) => {
  const t = todayInAppTimeZone();
  const today = toDateInputValue(utcDate(t.year, t.month, t.day));
  const lastMonthStart = utcDate(t.year, t.month - 1, 1);
  const monthStart = utcDate(t.year, t.month, 1);
  const yearAgo = utcDate(t.year, t.month - 12, 1);

  const [activity, transactionCount, importedCount, budgets, goals, months, lastMonthSpend] =
    await Promise.all([
      // created_at is stored in UTC: convert to Italian local days.
      prisma.$queryRaw<{ day: Date }[]>`
        SELECT DISTINCT (("created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Rome')::date AS day
        FROM "transactions" WHERE "user_id" = ${userId}`,
      prisma.transaction.count({ where: { userId } }),
      prisma.transaction.count({ where: { userId, tags: { has: "importato" } } }),
      prisma.budget.findMany({
        where: { householdId },
        select: {
          categoryId: true,
          amount: true,
          category: { select: { children: { select: { id: true } } } },
        },
      }),
      prisma.goal.findMany({
        where: { householdId },
        select: { targetAmount: true, currentAmount: true },
      }),
      prisma.$queryRaw<
        { month: Date; income: Prisma.Decimal | null; expense: Prisma.Decimal | null }[]
      >`
        SELECT date_trunc('month', "date")::date AS month,
          SUM(CASE WHEN "type"::text = 'INCOME' THEN "base_amount" END) AS income,
          SUM(CASE WHEN "type"::text = 'EXPENSE' THEN "base_amount" END) AS expense
        FROM "transactions"
        WHERE "household_id" = ${householdId} AND "date" >= ${yearAgo}::date AND "date" < ${monthStart}::date
        GROUP BY 1`,
      prisma.transaction.groupBy({
        by: ["categoryId"],
        where: { householdId, type: "EXPENSE", date: { gte: lastMonthStart, lt: monthStart } },
        _sum: { baseAmount: true },
      }),
    ]);

  const spent = new Map(lastMonthSpend.map((s) => [s.categoryId, Number(s._sum.baseAmount ?? 0)]));
  const lastMonthWithinBudget =
    budgets.length === 0
      ? null
      : budgets.every((b) => {
          const ids = [b.categoryId, ...b.category.children.map((c) => c.id)];
          const total = ids.reduce((sum, id) => sum + (spent.get(id) ?? 0), 0);
          return total <= Number(b.amount);
        });

  return computeGamification({
    activityDays: activity.map((a) => toDateInputValue(a.day)),
    today,
    transactionCount,
    importedCount,
    budgetCount: budgets.length,
    completedGoals: goals.filter((g) => g.currentAmount.gte(g.targetAmount)).length,
    months: months.map((m) => ({
      month: toDateInputValue(m.month).slice(0, 7),
      income: Number(m.income ?? 0),
      expense: Number(m.expense ?? 0),
    })),
    lastMonthWithinBudget,
  });
});
