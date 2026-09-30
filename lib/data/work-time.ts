import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { workRate } from "@/lib/finance/work-time";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";

/**
 * The user's working-time rate: from the net income they entered, or estimated from the income
 * they recorded themselves in this space over the last three complete months.
 */
export const getWorkSettings = cache(async (userId: string, householdId: string) => {
  const t = todayInAppTimeZone();
  const monthStart = utcDate(t.year, t.month, 1);
  const from = utcDate(t.year, t.month - 3, 1);

  const [user, months] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { monthlyNetIncome: true, workHoursPerWeek: true, showWorkTime: true },
    }),
    prisma.$queryRaw<{ total: unknown }[]>`
      SELECT SUM("base_amount") AS total
      FROM "transactions"
      WHERE "household_id" = ${householdId} AND "user_id" = ${userId}
        AND "type"::text = 'INCOME' AND "date" >= ${from}::date AND "date" < ${monthStart}::date
      GROUP BY date_trunc('month', "date")`,
  ]);

  // Averaged over the months with income, so a user who started last month isn't a third.
  const estimated = months.length
    ? months.reduce((s, m) => s + Number(m.total), 0) / months.length
    : null;
  const manual = user.monthlyNetIncome ? Number(user.monthlyNetIncome) : null;
  const monthly = manual ?? estimated;

  return {
    enabled: user.showWorkTime,
    weeklyHours: user.workHoursPerWeek,
    manualIncome: manual,
    estimatedIncome: estimated === null ? null : Math.round(estimated * 100) / 100,
    rate: user.showWorkTime && monthly ? workRate(monthly, user.workHoursPerWeek) : null,
  };
});
