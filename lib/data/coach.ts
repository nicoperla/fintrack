import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { getAccountsWithBalances } from "@/lib/data/accounts";
import { getInvestments } from "@/lib/data/investments";
import { getBudgetsWithSpending } from "@/lib/data/budgets";
import { getForecast } from "@/lib/data/forecast";
import { getGoals } from "@/lib/data/goals";
import { getDebts, getRecurring } from "@/lib/data/intelligence";
import { getWorkSettings } from "@/lib/data/work-time";
import { buildCoachReport, isNeed, type CoachInput } from "@/lib/finance/coach";
import { readCoachProfile } from "@/lib/finance/coach-profile";
import { formatMonth, formatMonthYear, todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

const DAY_MS = 86_400_000;
const COMPLETE_MONTHS = 3;
const VICE = /tabacc|sigarett|svapo|iqos|scommess|lotto|gratta/i;

type MonthRow = { month: Date; type: string; category_id: string | null; total: unknown };

/**
 * Everything the coach looks at for the user in the active space: the last complete months,
 * this month so far, accounts, recurring costs, budgets, goals, debts and the forecast.
 */
export const getCoachData = cache(async (userId: string, householdId: string) => {
  const t = todayInAppTimeZone();
  const monthStart = utcDate(t.year, t.month, 1);
  const from = utcDate(t.year, t.month - COMPLETE_MONTHS, 1);
  const today = utcDate(t.year, t.month, t.day);
  const daysInMonth = utcDate(t.year, t.month + 1, 0).getUTCDate();

  const [
    user,
    currency,
    categories,
    rows,
    accounts,
    recurring,
    budgets,
    goals,
    debts,
    forecast,
    work,
    small,
    uncategorized,
    counts,
    investments,
  ] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { coachProfile: true } }),
    prisma.household
      .findUniqueOrThrow({ where: { id: householdId }, select: { currency: true } })
      .then((h) => h.currency),
    prisma.category.findMany({
      where: { householdId },
      select: { id: true, name: true, icon: true, color: true, parentId: true, type: true },
      orderBy: { name: "asc" },
    }),
    prisma.$queryRaw<MonthRow[]>`
      SELECT date_trunc('month', "date") AS month, "type"::text AS type, "category_id", SUM("base_amount") AS total
      FROM "transactions"
      WHERE "household_id" = ${householdId} AND "type"::text <> 'TRANSFER' AND "date" >= ${from}::date
      GROUP BY 1, 2, 3`,
    getAccountsWithBalances(householdId),
    getRecurring(householdId),
    getBudgetsWithSpending(householdId),
    getGoals(householdId),
    getDebts(householdId),
    getForecast(householdId),
    getWorkSettings(userId, householdId),
    prisma.transaction.aggregate({
      where: {
        householdId,
        type: "EXPENSE",
        baseAmount: { lt: 10 },
        date: { gte: new Date(today.getTime() - 30 * DAY_MS), lte: today },
      },
      _count: { _all: true },
      _sum: { baseAmount: true },
    }),
    prisma.transaction.count({
      where: {
        householdId,
        type: { in: ["INCOME", "EXPENSE"] },
        categoryId: null,
        date: { gte: new Date(today.getTime() - 90 * DAY_MS) },
      },
    }),
    prisma.transaction.count({ where: { householdId } }),
    getInvestments(householdId),
  ]);

  const { profile, configured } = readCoachProfile(user.coachProfile);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const topOf = (id: string | null) => {
    let c = id ? byId.get(id) : undefined;
    while (c?.parentId && byId.has(c.parentId)) c = byId.get(c.parentId);
    return c ?? null;
  };

  // Months with any movement: a user who started last month isn't averaged with empty months.
  const monthKeys: string[] = [];
  for (let i = COMPLETE_MONTHS; i >= 1; i--) {
    monthKeys.push(toDateInputValue(utcDate(t.year, t.month - i, 1)).slice(0, 7));
  }
  const currentKey = toDateInputValue(monthStart).slice(0, 7);
  const keyOf = (d: Date) => toDateInputValue(d).slice(0, 7);
  const active = monthKeys.filter((k) => rows.some((r) => keyOf(r.month) === k));

  const totals = (key: string, type: string) =>
    rows
      .filter((r) => keyOf(r.month) === key && r.type === type)
      .reduce((s, r) => s + Number(r.total), 0);

  const topCategories = categories.filter((c) => c.type === "EXPENSE" && !c.parentId);
  const categorySum = (topId: string, key: string) =>
    rows
      .filter(
        (r) => r.type === "EXPENSE" && keyOf(r.month) === key && topOf(r.category_id)?.id === topId,
      )
      .reduce((s, r) => s + Number(r.total), 0);

  // Vices: tobacco, betting, lottery, wherever they sit in the tree, each movement counted once.
  const viceCategories = categories.filter((c) => c.type === "EXPENSE" && VICE.test(c.name));
  const viceIds = new Set(viceCategories.map((c) => c.id));
  const isVice = (id: string | null) => {
    for (
      let c = id ? byId.get(id) : undefined;
      c;
      c = c.parentId ? byId.get(c.parentId) : undefined
    ) {
      if (viceIds.has(c.id)) return true;
    }
    return false;
  };
  const viceTotal = rows
    .filter((r) => r.type === "EXPENSE" && active.includes(keyOf(r.month)) && isVice(r.category_id))
    .reduce((s, r) => s + Number(r.total), 0);
  // Name the outermost matching categories ("Tabacchi", not also "Sigarette"), biggest first.
  const viceSpend = (id: string) =>
    rows
      .filter((r) => r.type === "EXPENSE" && active.includes(keyOf(r.month)))
      .filter((r) => {
        for (
          let c = r.category_id ? byId.get(r.category_id) : undefined;
          c;
          c = c.parentId ? byId.get(c.parentId) : undefined
        ) {
          if (c.id === id) return true;
        }
        return false;
      })
      .reduce((s, r) => s + Number(r.total), 0);
  const viceNames = viceCategories
    .filter((c) => !c.parentId || !viceIds.has(c.parentId))
    .map((c) => ({ name: c.name, spend: viceSpend(c.id) }))
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .map((c) => c.name);

  const salary = recurring
    .filter((r) => r.active && r.type === "INCOME")
    .sort((a, b) => b.averageAmount - a.averageAmount)[0];

  const input: CoachInput = {
    profile,
    currency,
    months: active.map((key) => ({
      label: formatMonth(new Date(`${key}-01T00:00:00Z`)),
      income: totals(key, "INCOME"),
      expense: totals(key, "EXPENSE"),
    })),
    thisMonth: {
      name: formatMonth(monthStart),
      income: totals(currentKey, "INCOME"),
      expense: totals(currentKey, "EXPENSE"),
      day: t.day,
      daysInMonth,
    },
    categories: topCategories
      .map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        monthly: active.map((key) => categorySum(c.id, key)),
        thisMonth: categorySum(c.id, currentKey),
      }))
      .filter((c) => c.thisMonth > 0 || c.monthly.some((v) => v > 0)),
    savingsBalance: accounts
      .filter((a) => a.type === "SAVINGS" && !a.archived)
      .reduce((s, a) => s + a.baseBalance, 0),
    everydayBalance: accounts
      .filter((a) => ["CHECKING", "CARD", "CASH"].includes(a.type) && !a.archived)
      .reduce((s, a) => s + a.baseBalance, 0),
    // What the investments are worth (the values entered), not just what was put in.
    investmentBalance: investments.total?.value ?? 0,
    // Rent, bills and loan instalments are recurring too, but they're not subscriptions to review.
    subscriptions: recurring
      .filter((r) => r.active && r.type === "EXPENSE")
      .filter((r) => {
        const top = topOf(r.categoryId);
        return !top || !isNeed(top.name);
      })
      .map((r) => ({ name: r.name, monthlyCost: r.monthlyCost })),
    budgets: budgets.map((b) => ({
      name: b.categoryName,
      categoryId: b.categoryId,
      amount: b.amount,
      spent: b.spent,
      status: b.status,
    })),
    goals: goals
      .filter((g) => !g.completed)
      .map((g) => ({
        name: g.name,
        remaining: g.targetAmount - g.currentAmount,
        suggestedMonthly: g.suggestedMonthly,
      })),
    debts,
    forecast: forecast
      ? {
          lowDate: forecast.low.date,
          lowBalance: forecast.low.balance,
          dailySpend: forecast.dailySpend,
        }
      : null,
    vices: {
      names: viceNames,
      average: active.length ? viceTotal / active.length : 0,
      categoryIds: Array.from(viceIds),
    },
    smallExpenses: {
      count: small._count._all,
      total: Number(small._sum.baseAmount ?? 0),
    },
    uncategorized,
    salaryDay: salary ? Number(salary.nextDate.slice(8, 10)) : null,
    workRate: work.rate,
  };

  // Budgets cover their subcategories: map every category to the budget that counts it.
  const budgetFor: Record<string, { name: string; amount: number; spent: number }> = {};
  for (const b of budgets) {
    const entry = { name: b.categoryName, amount: b.amount, spent: b.spent };
    budgetFor[b.categoryId] = entry;
    for (const c of categories) if (c.parentId === b.categoryId) budgetFor[c.id] ??= entry;
  }

  return {
    input,
    report: buildCoachReport(input),
    profile,
    configured,
    monthLabel: formatMonthYear(monthStart),
    stats: {
      transactions: counts,
      categories: categories.length,
      accounts: accounts.filter((a) => !a.archived).length,
    },
    /** Top-level expense categories, for the "never cut these" picker. */
    expenseCategories: topCategories.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
    })),
    forecast,
    budgetFor,
    goals: goals
      .filter((g) => !g.completed)
      .map((g) => ({ name: g.name, remaining: g.targetAmount - g.currentAmount })),
  };
});

export type CoachData = Awaited<ReturnType<typeof getCoachData>>;

/** Recent movements, compact, for the AI coach to answer specific questions. */
export async function getRecentMovements(householdId: string, days = 90, limit = 300) {
  const t = todayInAppTimeZone();
  const since = new Date(utcDate(t.year, t.month, t.day).getTime() - days * DAY_MS);
  const rows = await prisma.transaction.findMany({
    where: { householdId, date: { gte: since } },
    orderBy: { date: "desc" },
    take: limit,
    select: {
      date: true,
      type: true,
      baseAmount: true,
      description: true,
      tags: true,
      category: { select: { name: true, parent: { select: { name: true } } } },
      account: { select: { name: true } },
      transferAccount: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    date: toDateInputValue(r.date),
    type: r.type,
    amount: Number(r.baseAmount),
    description: r.description,
    category: r.category
      ? r.category.parent
        ? `${r.category.parent.name} › ${r.category.name}`
        : r.category.name
      : null,
    account: r.transferAccount ? `${r.account.name} → ${r.transferAccount.name}` : r.account.name,
    tags: r.tags,
  }));
}
