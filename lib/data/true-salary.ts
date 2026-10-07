import { cache } from "react";
import type { AccountType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getAccountsWithBalances } from "@/lib/data/accounts";
import { getRecurring } from "@/lib/data/intelligence";
import {
  BIG_EXPENSE_PRESETS,
  IGNORED_RECURRING_PREFIX,
  RESERVE_ACCOUNT_TYPES,
  computeTrueSalary,
  lastYearAmount,
  nextPayday,
  recurringBigExpenses,
  yearAhead,
  type BigExpenseInput,
  type RecurringForSalary,
} from "@/lib/finance/true-salary";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

/** The money used day to day, as in the forecast: savings and investments don't pay the bills. */
const EVERYDAY_TYPES = new Set<AccountType>(["CHECKING", "CARD", "CASH"]);
const RESERVE_TYPES = new Set(RESERVE_ACCOUNT_TYPES);

const DAY_MS = 86_400_000;

function todayIso() {
  const t = todayInAppTimeZone();
  return toDateInputValue(utcDate(t.year, t.month, t.day));
}

/** "Lo stipendio vero" of a space, null without everyday accounts. */
export const getTrueSalary = cache(async (householdId: string) => {
  const today = todayIso();
  const [household, accounts, recurring, rows, dismissals] = await Promise.all([
    prisma.household.findUniqueOrThrow({
      where: { id: householdId },
      select: {
        trueSalarySince: true,
        payday: true,
        thirteenthSalary: true,
        fourteenthSalary: true,
        reserveAccountId: true,
      },
    }),
    getAccountsWithBalances(householdId),
    getRecurring(householdId),
    prisma.bigExpense.findMany({
      where: { householdId },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.foundMoneyDismissal.findMany({
      where: { householdId, key: { startsWith: IGNORED_RECURRING_PREFIX } },
      select: { key: true },
    }),
  ]);

  const reserveAccount =
    accounts.find((a) => a.id === household.reserveAccountId && RESERVE_TYPES.has(a.type)) ?? null;
  const everyday = accounts.filter(
    (a) => EVERYDAY_TYPES.has(a.type) && a.id !== reserveAccount?.id,
  );
  if (everyday.length === 0) return null;

  const active = recurring.filter((r) => r.active);
  // The largest regular income is the salary that opens the next period.
  const salary =
    active
      .filter((r) => r.type === "INCOME" && r.frequency !== "quarterly" && r.frequency !== "yearly")
      .sort((a, b) => b.monthlyCost - a.monthlyCost)[0] ?? null;
  const payday = nextPayday({ today, day: household.payday, salary });

  const ignored = new Set(dismissals.map((d) => d.key.slice(IGNORED_RECURRING_PREFIX.length)));
  const toInput = (r: (typeof active)[number]): RecurringForSalary => ({
    key: r.key,
    name: r.name,
    type: r.type,
    amount: r.averageAmount,
    nextDate: r.nextDate,
    frequency: r.frequency,
  });
  const counted = active.filter((r) => !ignored.has(r.key)).map(toInput);
  const bigExpenses: (BigExpenseInput & { preset: string | null })[] = rows.map((row) => ({
    id: row.id,
    preset: row.preset,
    name: row.name,
    amount: Number(row.amount),
    months: row.months,
    day: row.day,
    paidThrough: row.paidThrough ? toDateInputValue(row.paidThrough) : null,
  }));

  const result = computeTrueSalary({
    today,
    payday,
    everyday: everyday.map((a) => ({ name: a.name, balance: a.baseBalance })),
    recurring: counted,
    bigExpenses,
    extraSalaries: {
      thirteenth: household.thirteenthSalary ? Number(household.thirteenthSalary) : null,
      fourteenth: household.fourteenthSalary ? Number(household.fourteenthSalary) : null,
    },
    reserveAccount: reserveAccount
      ? { name: reserveAccount.name, balance: reserveAccount.baseBalance }
      : null,
  });

  return {
    ...result,
    /** Shown on the dashboard. */
    active: household.trueSalarySince !== null,
    plan: yearAhead({ today, bigExpenses, recurring: counted }),
    bigExpenses,
    /** Found among the movements and set aside as "non contarla". */
    ignored: recurringBigExpenses(active.map(toInput)).filter((r) => ignored.has(r.key)),
    settings: {
      payday: household.payday,
      thirteenth: household.thirteenthSalary ? Number(household.thirteenthSalary) : null,
      fourteenth: household.fourteenthSalary ? Number(household.fourteenthSalary) : null,
      reserveAccountId: reserveAccount?.id ?? null,
    },
    /** The salary found among the movements, for the payday field's hint. */
    detectedSalary: salary
      ? { name: salary.name, day: Number(salary.nextDate.slice(8, 10)) }
      : null,
    reserveOptions: accounts
      .filter((a) => RESERVE_TYPES.has(a.type) && !a.archived)
      .map((a) => ({ id: a.id, name: a.name })),
  };
});

export type TrueSalaryData = NonNullable<Awaited<ReturnType<typeof getTrueSalary>>>;

/** For each Italian big expense, what the user paid for it in the last twelve months. */
export async function getLastYearAmounts(householdId: string) {
  const today = todayIso();
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - 366 * DAY_MS);
  const rows = await prisma.transaction.findMany({
    where: { householdId, type: "EXPENSE", date: { gte: since } },
    select: {
      date: true,
      description: true,
      baseAmount: true,
      category: { select: { name: true, parent: { select: { name: true } } } },
    },
  });
  const history = rows.map((r) => ({
    date: toDateInputValue(r.date),
    description: r.description,
    amount: Number(r.baseAmount),
    category: r.category?.name ?? null,
    parentCategory: r.category?.parent?.name ?? null,
  }));
  return Object.fromEntries(
    BIG_EXPENSE_PRESETS.map((p) => [p.key, lastYearAmount(p, history, today)]),
  ) as Record<string, ReturnType<typeof lastYearAmount>>;
}
