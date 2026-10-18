import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { getAccountsWithBalances } from "@/lib/data/accounts";
import { getRecurring } from "@/lib/data/intelligence";
import { forecastBalance } from "@/lib/finance/forecast";
import { expected730Events } from "@/lib/tax/calendar";
import { rulesFor } from "@/lib/tax/rules";
import { readSituation, withoutAgent } from "@/lib/tax/situation";
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
export const getForecast = cache(async (householdId: string) => {
  const t = todayInAppTimeZone();
  const today = utcDate(t.year, t.month, t.day);
  const since = new Date(today.getTime() - SPENDING_WINDOW_DAYS * DAY_MS);

  const [accounts, recurring, expenses, household, taxYears] = await Promise.all([
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
    prisma.household.findUnique({ where: { id: householdId }, select: { payday: true } }),
    // "Il mio 730" of the space's members: a refund or a debt still to come.
    prisma.taxYear
      .findMany({
        where: {
          user: { memberships: { some: { householdId } } },
          sentAt: { not: null },
          result: { not: null },
          year: { gte: t.year - 2 },
        },
        select: {
          year: true,
          sentAt: true,
          result: true,
          secondAdvance: true,
          refundReceivedAt: true,
          answers: true,
        },
      })
      // The forecast must never break over the 730: without the rows it just leaves them out.
      .catch(() => []),
  ]);
  const oneOff = taxYears.flatMap((row) => {
    const situation = readSituation(row.answers);
    return expected730Events({
      rules: rulesFor(row.year),
      sentAt: toDateInputValue(row.sentAt!),
      payer: withoutAgent(situation)
        ? "agency"
        : situation.work === "pensioner"
          ? "pensioner"
          : "employee",
      result: Number(row.result),
      refundReceived: row.refundReceivedAt !== null,
      secondAdvance: row.secondAdvance === null ? null : Number(row.secondAdvance),
      payday: household?.payday ?? 27,
    });
  });

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
    oneOff,
  });

  return {
    ...forecast,
    dailySpend: Math.round(dailySpend * 100) / 100,
    accounts: everyday.map((a) => a.name),
  };
});

export type ForecastData = NonNullable<Awaited<ReturnType<typeof getForecast>>>;
