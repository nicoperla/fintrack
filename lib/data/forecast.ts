import { prisma } from "@/lib/db/prisma";
import { getAccountsWithBalances } from "@/lib/data/accounts";
import { getRecurring } from "@/lib/data/intelligence";
import { forecastBalance } from "@/lib/finance/forecast";
import { normalizeDescription } from "@/lib/finance/recurring";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

export const FORECAST_DAYS = 45;
/** How far back the usual day-to-day spending is measured. */
const SPENDING_WINDOW_DAYS = 60;
const DAY_MS = 86_400_000;

// The money used day to day: savings and investments don't pay the bills.
const EVERYDAY_TYPES = new Set(["CHECKING", "CARD", "CASH"]);

/** The everyday accounts' balance for the next weeks, in the space currency. */
export async function getForecast(householdId: string) {
  const t = todayInAppTimeZone();
  const today = utcDate(t.year, t.month, t.day);
  const since = new Date(today.getTime() - SPENDING_WINDOW_DAYS * DAY_MS);

  const [accounts, recurring, expenses] = await Promise.all([
    getAccountsWithBalances(householdId),
    getRecurring(householdId),
    prisma.transaction.findMany({
      where: {
        householdId,
        type: "EXPENSE",
        date: { gte: since, lt: today },
        account: { type: { in: ["CHECKING", "CARD", "CASH"] } },
      },
      select: { date: true, baseAmount: true, description: true },
    }),
  ]);

  const everyday = accounts.filter((a) => EVERYDAY_TYPES.has(a.type));
  if (everyday.length === 0) return null;

  const active = recurring.filter((r) => r.active);
  // Recurring bills are placed on their own days: leave them out of the daily average.
  const recurringKeys = new Set(active.map((r) => r.key));
  const dayToDay = expenses.filter(
    (e) => !recurringKeys.has(`EXPENSE|${normalizeDescription(e.description)}`),
  );
  const first = expenses.reduce<Date | null>(
    (min, e) => (!min || e.date < min ? e.date : min),
    null,
  );
  // New users: average over the days actually tracked (at least a week), not the whole window.
  const trackedDays = first
    ? Math.max(7, Math.min(SPENDING_WINDOW_DAYS, (today.getTime() - first.getTime()) / DAY_MS))
    : SPENDING_WINDOW_DAYS;
  const dailySpend = dayToDay.reduce((s, e) => s + Number(e.baseAmount), 0) / trackedDays;

  const forecast = forecastBalance({
    today: toDateInputValue(today),
    start: everyday.reduce((s, a) => s + a.baseBalance, 0),
    days: FORECAST_DAYS,
    dailySpend,
    recurring: active.map((r) => ({
      name: r.name,
      type: r.type,
      amount: r.averageAmount,
      nextDate: r.nextDate,
      frequency: r.frequency,
    })),
  });

  return {
    ...forecast,
    dailySpend: Math.round(dailySpend * 100) / 100,
    accounts: everyday.map((a) => a.name),
  };
}

export type ForecastData = NonNullable<Awaited<ReturnType<typeof getForecast>>>;
