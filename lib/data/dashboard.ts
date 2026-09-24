import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getAccountsWithBalances } from "@/lib/data/accounts";
import { summarizeByTopCategory } from "@/lib/finance/dashboard-math";
import {
  formatMonth,
  formatMonthShort,
  formatMonthYear,
  todayInAppTimeZone,
  utcDate,
} from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

const TREND_MONTHS = 6;

type MonthlyRow = { month: Date; type: "INCOME" | "EXPENSE"; total: Prisma.Decimal };

export async function getDashboardData(userId: string) {
  const { year, month, day } = todayInAppTimeZone();
  const trendStart = utcDate(year, month - (TREND_MONTHS - 1), 1);
  const monthStart = utcDate(year, month, 1);
  const nextMonthStart = utcDate(year, month + 1, 1);
  // The current month is partial: compare it with the same days of the previous month.
  const previousMonthStart = utcDate(year, month - 1, 1);
  const previousMonthDays = utcDate(year, month, 0).getUTCDate();
  const previousSamePeriodEnd = utcDate(year, month - 1, Math.min(day, previousMonthDays));

  const [accounts, monthlyRows, categorySums, categories, previousSamePeriod] = await Promise.all([
    getAccountsWithBalances(userId),
    prisma.$queryRaw<MonthlyRow[]>`
      SELECT date_trunc('month', "date")::date AS month, "type"::text AS type, SUM("amount") AS total
      FROM "transactions"
      WHERE "user_id" = ${userId}
        AND "type"::text IN ('INCOME', 'EXPENSE')
        AND "date" >= ${trendStart}::date
        AND "date" < ${nextMonthStart}::date
      GROUP BY 1, 2`,
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type: "EXPENSE", date: { gte: monthStart, lt: nextMonthStart } },
      _sum: { amount: true },
    }),
    prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, color: true, parentId: true },
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      where: {
        userId,
        type: { in: ["INCOME", "EXPENSE"] },
        date: { gte: previousMonthStart, lte: previousSamePeriodEnd },
      },
      _sum: { amount: true },
    }),
  ]);

  const previousSum = (type: "INCOME" | "EXPENSE") =>
    Number(previousSamePeriod.find((r) => r.type === type)?._sum.amount ?? 0);

  const totals = new Map<string, { income: number; expense: number }>();
  for (const row of monthlyRows) {
    const key = toDateInputValue(row.month).slice(0, 7);
    const entry = totals.get(key) ?? { income: 0, expense: 0 };
    entry[row.type === "INCOME" ? "income" : "expense"] += Number(row.total);
    totals.set(key, entry);
  }

  const trend = Array.from({ length: TREND_MONTHS }, (_, i) => {
    const date = utcDate(year, month - (TREND_MONTHS - 1) + i, 1);
    const key = toDateInputValue(date).slice(0, 7);
    return {
      key,
      short: formatMonthShort(date),
      label: formatMonthYear(date),
      ...(totals.get(key) ?? { income: 0, expense: 0 }),
    };
  });

  const current = trend[trend.length - 1];
  const netWorth = accounts.reduce((sum, a) => sum.plus(a.balance), new Prisma.Decimal(0));
  const monthEnd = utcDate(year, month + 1, 0);

  return {
    accountCount: accounts.length,
    netWorth: netWorth.toNumber(),
    monthName: formatMonth(monthStart),
    monthLabel: formatMonthYear(monthStart),
    previousMonthName: formatMonth(previousMonthStart),
    monthRange: { from: toDateInputValue(monthStart), to: toDateInputValue(monthEnd) },
    current: { income: current.income, expense: current.expense },
    previousSamePeriod: { income: previousSum("INCOME"), expense: previousSum("EXPENSE") },
    trend,
    categories: summarizeByTopCategory(
      categorySums.map((s) => ({ categoryId: s.categoryId, amount: Number(s._sum.amount ?? 0) })),
      categories,
    ),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
