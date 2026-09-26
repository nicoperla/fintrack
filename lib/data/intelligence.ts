import { prisma } from "@/lib/db/prisma";
import { getAccountsWithBalances } from "@/lib/data/accounts";
import { detectRecurring } from "@/lib/finance/recurring";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";
import type { QuickEntryContext } from "@/lib/quick-entry/parse";

const DAY_MS = 86_400_000;
/** Enough history to see a yearly subscription renew once. */
const RECURRING_LOOKBACK_DAYS = 400;

function todayIso() {
  const t = todayInAppTimeZone();
  return toDateInputValue(utcDate(t.year, t.month, t.day));
}

// ---------- Recurring ----------

export async function getRecurring(householdId: string) {
  const today = todayIso();
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - RECURRING_LOOKBACK_DAYS * DAY_MS);
  const [transactions, categories] = await Promise.all([
    prisma.transaction.findMany({
      where: { householdId, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: since } },
      select: { date: true, baseAmount: true, description: true, type: true, categoryId: true },
    }),
    prisma.category.findMany({
      where: { householdId },
      select: { id: true, name: true, icon: true, color: true },
    }),
  ]);
  const byId = new Map(categories.map((c) => [c.id, c]));

  return detectRecurring(
    transactions.map((t) => ({
      date: toDateInputValue(t.date),
      amount: Number(t.baseAmount),
      description: t.description,
      type: t.type === "INCOME" ? "INCOME" : "EXPENSE",
      categoryId: t.categoryId,
    })),
    today,
  ).map((r) => ({ ...r, category: r.categoryId ? (byId.get(r.categoryId) ?? null) : null }));
}

export type RecurringWithCategory = Awaited<ReturnType<typeof getRecurring>>[number];

// ---------- Quick entry ----------

const HINT_LIMIT = 300;

export async function getQuickEntryContext(householdId: string): Promise<QuickEntryContext> {
  const today = todayIso();
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - 60 * DAY_MS);
  const [categories, accounts, mostUsed, hints] = await Promise.all([
    prisma.category.findMany({
      where: { householdId },
      select: { id: true, name: true, type: true },
    }),
    prisma.financialAccount.findMany({
      where: { householdId },
      select: { id: true, name: true, type: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.groupBy({
      by: ["accountId"],
      where: { householdId, type: "EXPENSE", date: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { accountId: "desc" } },
      take: 1,
    }),
    prisma.$queryRaw<{ description: string; category_id: string }[]>`
      SELECT DISTINCT ON (lower("description")) "description", "category_id"
      FROM "transactions"
      WHERE "household_id" = ${householdId} AND "category_id" IS NOT NULL AND "type"::text <> 'TRANSFER'
      ORDER BY lower("description"), "date" DESC
      LIMIT ${HINT_LIMIT}`,
  ]);

  return {
    today,
    categories: categories
      .filter((c) => c.type !== "TRANSFER")
      .map((c) => ({ id: c.id, name: c.name, type: c.type === "INCOME" ? "INCOME" : "EXPENSE" })),
    accounts,
    defaultAccountId: mostUsed[0]?.accountId ?? accounts[0]?.id ?? null,
    hints: hints.map((h) => ({ description: h.description, categoryId: h.category_id })),
  };
}

// ---------- Debts ----------

export async function getDebts(householdId: string) {
  const debts = await prisma.debt.findMany({
    where: { householdId },
    orderBy: { createdAt: "asc" },
  });
  return debts.map((d) => ({
    id: d.id,
    name: d.name,
    balance: Number(d.balance),
    apr: Number(d.interestRate),
    minPayment: Number(d.minimumPayment),
  }));
}

// ---------- Simulator ----------

export async function getSimulatorDefaults(householdId: string) {
  const t = todayInAppTimeZone();
  const from = utcDate(t.year, t.month - 3, 1);
  const to = utcDate(t.year, t.month, 1);
  const [accounts, sums, goals] = await Promise.all([
    getAccountsWithBalances(householdId),
    prisma.transaction.groupBy({
      by: ["type"],
      where: { householdId, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: from, lt: to } },
      _sum: { baseAmount: true },
    }),
    prisma.goal.findMany({ where: { householdId }, orderBy: { createdAt: "asc" } }),
  ]);
  const sum = (type: string) => Number(sums.find((s) => s.type === type)?._sum.baseAmount ?? 0);

  return {
    netWorth: accounts.reduce((s, a) => s + a.baseBalance, 0),
    // Average of the last three complete months; never suggest a negative baseline.
    averageMonthlySavings: Math.max(0, Math.round((sum("INCOME") - sum("EXPENSE")) / 3)),
    goals: goals
      .filter((g) => g.currentAmount.lt(g.targetAmount))
      .map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon,
        color: g.color,
        remaining: g.targetAmount.minus(g.currentAmount).toNumber(),
        targetDate: g.targetDate ? toDateInputValue(g.targetDate) : null,
      })),
  };
}
