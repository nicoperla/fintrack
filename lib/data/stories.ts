import { prisma } from "@/lib/db/prisma";
import { buildStory } from "@/lib/finance/stories";
import { formatMonth, todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

const monthKey = (d: Date) => toDateInputValue(d).slice(0, 7);

/**
 * Which month to tell: the one asked for if it has movements, else the last complete month
 * (a finished story), else the current one.
 */
export async function resolveStoryMonth(householdId: string, param?: string) {
  const t = todayInAppTimeZone();
  const current = utcDate(t.year, t.month, 1);
  const first = await prisma.transaction.findFirst({
    where: { householdId, type: { in: ["INCOME", "EXPENSE"] } },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  if (!first) return null;
  const earliest = utcDate(first.date.getUTCFullYear(), first.date.getUTCMonth(), 1);

  const match = param?.match(/^(\d{4})-(\d{2})$/);
  let month = match
    ? utcDate(Number(match[1]), Number(match[2]) - 1, 1)
    : utcDate(t.year, t.month - 1, 1);
  if (month > current) month = current;
  if (month < earliest) month = earliest;
  return { month, earliest, current };
}

/** The last complete month, if it has a story to tell (for the dashboard bubble). */
export async function getLatestStoryMonth(householdId: string) {
  const t = todayInAppTimeZone();
  const month = utcDate(t.year, t.month - 1, 1);
  const count = await prisma.transaction.count({
    where: {
      householdId,
      type: "EXPENSE",
      date: { gte: month, lt: utcDate(t.year, t.month, 1) },
    },
  });
  return count >= 5 ? { key: monthKey(month), name: formatMonth(month) } : null;
}

export async function getStory(householdId: string, param?: string) {
  const resolved = await resolveStoryMonth(householdId, param);
  if (!resolved) return null;
  const { month, earliest, current } = resolved;
  const next = utcDate(month.getUTCFullYear(), month.getUTCMonth() + 1, 1);
  const previous = utcDate(month.getUTCFullYear(), month.getUTCMonth() - 1, 1);
  const t = todayInAppTimeZone();
  const isCurrent = month.getTime() === current.getTime();
  const daysInMonth = utcDate(month.getUTCFullYear(), month.getUTCMonth() + 1, 0).getUTCDate();

  const [categories, rows, previousRows] = await Promise.all([
    prisma.category.findMany({
      where: { householdId },
      select: { id: true, name: true, icon: true, color: true, parentId: true },
    }),
    prisma.transaction.findMany({
      where: { householdId, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: month, lt: next } },
      select: { date: true, type: true, baseAmount: true, description: true, categoryId: true },
    }),
    month > earliest
      ? prisma.transaction.groupBy({
          by: ["type", "categoryId"],
          where: {
            householdId,
            type: { in: ["INCOME", "EXPENSE"] },
            date: { gte: previous, lt: month },
          },
          _sum: { baseAmount: true },
        })
      : Promise.resolve(null),
  ]);

  const byId = new Map(categories.map((c) => [c.id, c]));
  const topOf = (id: string | null) => {
    let c = id ? byId.get(id) : undefined;
    while (c?.parentId && byId.has(c.parentId)) c = byId.get(c.parentId);
    return c ? { id: c.id, name: c.name, icon: c.icon, color: c.color } : null;
  };

  let previousData = null;
  if (previousRows) {
    const byTop = new Map<string, number>();
    let income = 0;
    let expense = 0;
    for (const r of previousRows) {
      const amount = Number(r._sum.baseAmount ?? 0);
      if (r.type === "INCOME") income += amount;
      else {
        expense += amount;
        const top = topOf(r.categoryId);
        if (top) byTop.set(top.id, (byTop.get(top.id) ?? 0) + amount);
      }
    }
    previousData = {
      income,
      expense,
      categories: Array.from(byTop.entries()).map(([id, amount]) => ({ id, amount })),
    };
  }

  const story = buildStory({
    month: monthKey(month),
    daysInMonth,
    lastDay: isCurrent ? t.day : daysInMonth,
    transactions: rows.map((r) => ({
      date: toDateInputValue(r.date),
      type: r.type === "INCOME" ? "INCOME" : "EXPENSE",
      amount: Number(r.baseAmount),
      description: r.description,
      category: topOf(r.categoryId),
    })),
    previous: previousData,
  });

  return {
    story,
    monthName: formatMonth(month),
    previousMonthName: formatMonth(previous),
    year: month.getUTCFullYear(),
    isCurrent,
    prev: month > earliest ? monthKey(previous) : null,
    next: month < current ? monthKey(next) : null,
  };
}

export type StoryPage = NonNullable<Awaited<ReturnType<typeof getStory>>>;
