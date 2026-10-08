import { prisma } from "@/lib/db/prisma";
import { getAccountsWithBalances } from "@/lib/data/accounts";
import { getDebts } from "@/lib/data/intelligence";
import { getWorkSettings } from "@/lib/data/work-time";
import { isNeed } from "@/lib/finance/coach";
import { readCoachProfile } from "@/lib/finance/coach-profile";
import {
  EMERGENCY_GOAL,
  emergencyTarget,
  estimateRal,
  readCrashProfile,
  remainingMonths,
} from "@/lib/finance/crash-test";
import { readTaxProfile } from "@/lib/finance/rights";
import { formatMonth, todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

const COMPLETE_MONTHS = 3;
// What can be spent straight away: the everyday accounts and savings. Investments aside.
const LIQUID_TYPES = new Set(["CHECKING", "CARD", "CASH", "SAVINGS"]);

type MonthRow = { month: Date; type: string; category_id: string | null; total: unknown };

const cents = (n: number) => Math.round(n * 100) / 100;
const mean = (values: number[]) =>
  values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;

/**
 * The starting point of the crash test (money at hand and a usual month of the space), the
 * user's job for the NASpI, the debts for the mortgage and the emergency fund.
 */
export async function getCrashTest(userId: string, householdId: string) {
  const t = todayInAppTimeZone();
  const from = utcDate(t.year, t.month - COMPLETE_MONTHS, 1);
  const monthStart = utcDate(t.year, t.month, 1);

  const [user, household, categories, rows, accounts, debts, goals, work] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { crashProfile: true, taxProfile: true, coachProfile: true },
    }),
    prisma.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { currency: true, _count: { select: { members: true } } },
    }),
    prisma.category.findMany({
      where: { householdId },
      select: { id: true, name: true, parentId: true },
    }),
    prisma.$queryRaw<MonthRow[]>`
      SELECT date_trunc('month', "date") AS month, "type"::text AS type, "category_id", SUM("base_amount") AS total
      FROM "transactions"
      WHERE "household_id" = ${householdId} AND "type"::text <> 'TRANSFER'
        AND "date" >= ${from}::date AND "date" < ${monthStart}::date
      GROUP BY 1, 2, 3`,
    getAccountsWithBalances(householdId),
    getDebts(householdId),
    prisma.goal.findMany({
      where: { householdId },
      select: { id: true, name: true, targetAmount: true, currentAmount: true },
    }),
    getWorkSettings(userId, householdId),
  ]);

  const byId = new Map(categories.map((c) => [c.id, c]));
  const topName = (id: string | null) => {
    let c = id ? byId.get(id) : undefined;
    while (c?.parentId && byId.has(c.parentId)) c = byId.get(c.parentId);
    return c?.name ?? null;
  };

  // The complete months with movements: someone who started last month isn't averaged with zeros.
  const keyOf = (d: Date) => toDateInputValue(d).slice(0, 7);
  const months = Array.from({ length: COMPLETE_MONTHS }, (_, i) =>
    utcDate(t.year, t.month - COMPLETE_MONTHS + i, 1),
  ).filter((m) => rows.some((r) => keyOf(r.month) === keyOf(m)));
  const sum = (key: string, test: (r: MonthRow) => boolean) =>
    rows.filter((r) => keyOf(r.month) === key && test(r)).reduce((s, r) => s + Number(r.total), 0);
  const keys = months.map(keyOf);

  const liquidAccounts = accounts.filter((a) => LIQUID_TYPES.has(a.type) && !a.archived);
  const { profile: coach } = readCoachProfile(user.coachProfile);
  const taxProfile = readTaxProfile(user.taxProfile);
  const crash = readCrashProfile(user.crashProfile);
  const salary = work.manualIncome ?? work.estimatedIncome;

  const baseline = {
    liquid: cents(liquidAccounts.reduce((s, a) => s + a.baseBalance, 0)),
    income: cents(mean(keys.map((k) => sum(k, (r) => r.type === "INCOME")))),
    expense: cents(mean(keys.map((k) => sum(k, (r) => r.type === "EXPENSE")))),
    needs: cents(
      mean(
        keys.map((k) =>
          sum(k, (r) => r.type === "EXPENSE" && isNeed(topName(r.category_id) ?? "")),
        ),
      ),
    ),
  };
  const emergency = goals.find((g) => EMERGENCY_GOAL.pattern.test(g.name));

  return {
    /** "YYYY-MM" of this month, the first one the projections count from. */
    start: keyOf(monthStart),
    /** The months the usual income and spending come from: "luglio, agosto e settembre". */
    monthNames: months.map(formatMonth),
    hasData: months.length > 0 && liquidAccounts.length > 0,
    euro: household.currency === "EUR",
    currency: household.currency,
    shared: household._count.members > 1,
    baseline,
    accountNames: liquidAccounts.map((a) => a.name),
    hasInvestments: accounts.some((a) => a.type === "INVESTMENT" && !a.archived),
    job: {
      ...crash,
      birthYear: taxProfile.birthYear,
      age: taxProfile.birthYear ? t.year - taxProfile.birthYear : null,
      /** Net monthly salary: the one set in the settings, or the income the user recorded. */
      salary: salary === null ? null : cents(salary),
      salarySource: work.manualIncome !== null ? "settings" : salary !== null ? "estimated" : null,
      ralEstimate: salary ? estimateRal(salary) : null,
    },
    loans: debts.map((d) => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      rate: d.apr,
      payment: d.minPayment,
      months: remainingMonths(d.balance, d.apr, d.minPayment),
    })),
    emergency: {
      months: coach.emergencyMonths,
      target: emergencyTarget(baseline.expense, coach.emergencyMonths),
      goal: emergency
        ? {
            id: emergency.id,
            name: emergency.name,
            current: Number(emergency.currentAmount),
            target: Number(emergency.targetAmount),
          }
        : null,
    },
    today: { year: t.year, month: t.month },
  };
}

export type CrashTestData = Awaited<ReturnType<typeof getCrashTest>>;
