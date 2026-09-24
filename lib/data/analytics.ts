import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getAccountsWithBalances } from "@/lib/data/accounts";
import { summarizeByTopCategory } from "@/lib/finance/dashboard-math";
import { buildCashFlow, buildHeatmap, netWorthSeries, weekdayIndex } from "@/lib/finance/analytics";
import { generateInsights, type CategoryTotal } from "@/lib/finance/insights";
import { formatMonth, formatMonthYear, todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";
import { getRecurring } from "@/lib/data/intelligence";

const DAY_MS = 86_400_000;

function todayUtc() {
  const t = todayInAppTimeZone();
  return { ...t, date: utcDate(t.year, t.month, t.day) };
}

async function categoryInfo(userId: string) {
  return prisma.category.findMany({
    where: { userId },
    select: { id: true, name: true, color: true, icon: true, parentId: true },
  });
}

async function sumsByCategory(userId: string, type: "INCOME" | "EXPENSE", gte: Date, lt: Date) {
  const rows = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: { userId, type, date: { gte, lt } },
    _sum: { amount: true },
  });
  return rows.map((r) => ({ categoryId: r.categoryId, amount: Number(r._sum.amount ?? 0) }));
}

// ---------- Cash flow ----------

/** Parses "YYYY-MM"; falls back to the last complete month, which tells a full story. */
export function resolveFlowMonth(param: string | undefined, earliest: Date | null) {
  const today = todayUtc();
  const latest = utcDate(today.year, today.month, 1);
  const fallback = utcDate(today.year, today.month - 1, 1);
  const match = param?.match(/^(\d{4})-(\d{2})$/);
  let month = match ? utcDate(Number(match[1]), Number(match[2]) - 1, 1) : fallback;
  if (month > latest) month = latest;
  const min = earliest ? utcDate(earliest.getUTCFullYear(), earliest.getUTCMonth(), 1) : fallback;
  if (month < min) month = min;
  return { month, min, latest };
}

export async function getCashFlow(userId: string, monthParam: string | undefined) {
  const first = await prisma.transaction.findFirst({
    where: { userId },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  const { month, min, latest } = resolveFlowMonth(monthParam, first?.date ?? null);
  const next = utcDate(month.getUTCFullYear(), month.getUTCMonth() + 1, 1);

  const [categories, income, expense] = await Promise.all([
    categoryInfo(userId),
    sumsByCategory(userId, "INCOME", month, next),
    sumsByCategory(userId, "EXPENSE", month, next),
  ]);

  const key = (d: Date) => toDateInputValue(d).slice(0, 7);
  const prev = utcDate(month.getUTCFullYear(), month.getUTCMonth() - 1, 1);
  return {
    label: formatMonthYear(month),
    month: key(month),
    previous: month > min ? key(prev) : null,
    next: month < latest ? key(next) : null,
    isCurrentMonth: month.getTime() === latest.getTime(),
    ...buildCashFlow(
      summarizeByTopCategory(income, categories, 4),
      summarizeByTopCategory(expense, categories, 7),
    ),
  };
}

// ---------- Heatmap ----------

export async function getSpendingHeatmap(userId: string, weeks = 26) {
  const today = todayUtc().date;
  const start = new Date(today.getTime() - (weekdayIndex(today) + (weeks - 1) * 7) * DAY_MS);
  const [rows, first] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["date"],
      where: { userId, type: "EXPENSE", date: { gte: start, lte: today } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.findFirst({
      where: { userId },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
  ]);
  return buildHeatmap(
    rows.map((r) => ({
      date: toDateInputValue(r.date),
      amount: Number(r._sum.amount ?? 0),
      count: r._count._all,
    })),
    today,
    weeks,
    first?.date,
  );
}

// ---------- Net worth ----------

export const NET_WORTH_RANGES = { "3m": 3, "6m": 6, "1a": 12, tutto: null } as const;
export type NetWorthRange = keyof typeof NET_WORTH_RANGES;

export async function getNetWorth(userId: string, range: NetWorthRange) {
  const today = todayUtc();
  const [accounts, flows, first] = await Promise.all([
    getAccountsWithBalances(userId),
    prisma.$queryRaw<{ date: Date; net: Prisma.Decimal }[]>`
      SELECT "date", SUM(CASE WHEN "type"::text = 'INCOME' THEN "amount" ELSE -"amount" END) AS net
      FROM "transactions"
      WHERE "user_id" = ${userId} AND "type"::text IN ('INCOME', 'EXPENSE')
      GROUP BY "date"`,
    prisma.transaction.findFirst({
      where: { userId },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
  ]);

  const opening = accounts.reduce((sum, a) => sum + Number(a.initialBalance), 0);
  const months = NET_WORTH_RANGES[range];
  const rangeStart = months === null ? null : utcDate(today.year, today.month - months, today.day);
  // Start the day before the first transaction so the chart shows the opening balance.
  const historyStart = first ? new Date(first.date.getTime() - DAY_MS) : today.date;
  const start = rangeStart && rangeStart > historyStart ? rangeStart : historyStart;

  const series = netWorthSeries(
    opening,
    flows.map((f) => ({ date: toDateInputValue(f.date), net: Number(f.net) })),
    start,
    today.date,
  );

  const assets = accounts
    .filter((a) => a.balance.gt(0))
    .reduce((s, a) => s + a.balance.toNumber(), 0);
  const liabilities = accounts
    .filter((a) => a.balance.lt(0))
    .reduce((s, a) => s - a.balance.toNumber(), 0);
  const firstValue = series[0]?.value ?? 0;
  const lastValue = series.at(-1)?.value ?? 0;

  return {
    series,
    current: lastValue,
    change: lastValue - firstValue,
    changePct: firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : null,
    assets,
    liabilities,
  };
}

// ---------- Insights ----------

const LIFESTYLE_WINDOW_DAYS = 56;
/** One-off large payments (rent, insurance) would drown out day-to-day habits. */
const LIFESTYLE_MAX_AMOUNT = 300;

export async function getInsights(userId: string) {
  const today = todayUtc();
  const monthStart = utcDate(today.year, today.month, 1);
  const tomorrow = new Date(today.date.getTime() + DAY_MS);
  const prevStart = utcDate(today.year, today.month - 1, 1);
  const prevDays = utcDate(today.year, today.month, 0).getUTCDate();
  const prevSameEnd = utcDate(today.year, today.month - 1, Math.min(today.day, prevDays) + 1);
  const lifestyleStart = new Date(today.date.getTime() - LIFESTYLE_WINDOW_DAYS * DAY_MS);

  const [
    categories,
    now,
    previous,
    lastIncome,
    lastExpense,
    merchants,
    lifestyle,
    spendDays,
    recurring,
  ] = await Promise.all([
    categoryInfo(userId),
    sumsByCategory(userId, "EXPENSE", monthStart, tomorrow),
    sumsByCategory(userId, "EXPENSE", prevStart, prevSameEnd),
    sumsByCategory(userId, "INCOME", prevStart, monthStart),
    sumsByCategory(userId, "EXPENSE", prevStart, monthStart),
    prisma.transaction.groupBy({
      by: ["description"],
      where: { userId, type: "EXPENSE", date: { gte: monthStart, lt: tomorrow } },
      _count: { _all: true },
      _sum: { amount: true },
      orderBy: { _count: { description: "desc" } },
      take: 1,
    }),
    prisma.transaction.groupBy({
      by: ["date"],
      where: {
        userId,
        type: "EXPENSE",
        amount: { lt: LIFESTYLE_MAX_AMOUNT },
        date: { gte: lifestyleStart, lt: today.date },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["date"],
      where: { userId, type: "EXPENSE", date: { gte: monthStart, lt: tomorrow } },
    }),
    getRecurring(userId),
  ]);

  const byId = new Map(categories.map((c) => [c.id, c]));
  const rollUp = (sums: { categoryId: string | null; amount: number }[]): CategoryTotal[] => {
    const totals = new Map<string, number>();
    for (const s of sums) {
      const c = s.categoryId ? byId.get(s.categoryId) : undefined;
      if (!c) continue;
      const rootId = c.parentId && byId.has(c.parentId) ? c.parentId : c.id;
      totals.set(rootId, (totals.get(rootId) ?? 0) + s.amount);
    }
    return Array.from(totals, ([id, amount]) => {
      const c = byId.get(id)!;
      return { id, name: c.name, icon: c.icon, color: c.color, amount };
    });
  };
  const total = (sums: { amount: number }[]) => sums.reduce((s, x) => s + x.amount, 0);

  let weekday = 0;
  let weekend = 0;
  let weekdayDays = 0;
  let weekendDays = 0;
  const lifestyleByDate = new Map(
    lifestyle.map((l) => [toDateInputValue(l.date), Number(l._sum.amount ?? 0)]),
  );
  for (let t = lifestyleStart.getTime(); t < today.date.getTime(); t += DAY_MS) {
    const d = new Date(t);
    const amount = lifestyleByDate.get(toDateInputValue(d)) ?? 0;
    if (weekdayIndex(d) >= 5) {
      weekend += amount;
      weekendDays++;
    } else {
      weekday += amount;
      weekdayDays++;
    }
  }

  const merchant = merchants[0];
  return generateInsights({
    monthName: formatMonth(monthStart),
    previousMonthName: formatMonth(prevStart),
    categoriesNow: rollUp(now),
    categoriesPrevious: rollUp(previous),
    spentNow: total(now),
    spentPrevious: total(previous),
    lastMonth: {
      name: formatMonth(prevStart),
      income: total(lastIncome),
      expense: total(lastExpense),
    },
    topMerchant: merchant
      ? {
          name: merchant.description,
          count: merchant._count._all,
          amount: Number(merchant._sum.amount ?? 0),
        }
      : null,
    weekdayAverage: weekdayDays ? weekday / weekdayDays : 0,
    weekendAverage: weekendDays ? weekend / weekendDays : 0,
    noSpendDays: today.day - spendDays.length,
    priceIncreases: recurring
      .filter((r) => r.type === "EXPENSE" && r.active && r.priceChange)
      .map((r) => ({ name: r.name, ...r.priceChange! })),
  });
}
