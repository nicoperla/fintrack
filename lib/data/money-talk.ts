import { prisma } from "@/lib/db/prisma";
import { getRecurring } from "@/lib/data/intelligence";
import { getSplit, PERSONAL_TAG } from "@/lib/data/split";
import { getTariffometro } from "@/lib/data/tariffs";
import { isNeed } from "@/lib/finance/coach";
import { cancellableSubscriptions } from "@/lib/finance/found-money";
import { buildTalk, type TalkCategory } from "@/lib/finance/money-talk";
import { suggestedMonthlyContribution } from "@/lib/finance/planning";
import { paymentDates, paymentShare } from "@/lib/finance/true-salary";
import { dayInAppTimeZone, formatMonth, todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

const DAY_MS = 86_400_000;
/** Big expenses worth talking about: those due within six weeks. */
const UPCOMING_DAYS = 45;
/** A month with fewer shared expenses than this has little to talk about: no reminder. */
const REMINDER_MIN_EXPENSES = 5;

const monthKey = (d: Date) => toDateInputValue(d).slice(0, 7);
const cents = (n: number) => Math.round(n * 100) / 100;

/** The last complete month in Italy: the one a talk is about. */
export function lastCompleteMonth() {
  const t = todayInAppTimeZone();
  return utcDate(t.year, t.month - 1, 1);
}

/** "YYYY-MM" → first day of that month, or null when it's not a month. */
export function parseMonthKey(key: string) {
  const match = key.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? utcDate(Number(match[1]), month - 1, 1) : null;
}

/** First name, or the part of the email before the @ for people without a name. */
const firstName = (u: { name: string | null; email: string }) =>
  u.name?.split(" ")[0] || u.email.split("@")[0];

/**
 * Which month to talk about: the one asked for if the space has data for it, else the last
 * complete month. Null when the space has no movements at all, `early` when its first movements
 * are from this month (the first talk comes when the month is over).
 */
export async function resolveTalkMonth(householdId: string, param?: string) {
  const last = lastCompleteMonth();
  const first = await prisma.transaction.findFirst({
    where: { householdId, type: { in: ["INCOME", "EXPENSE"] } },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  if (!first) return null;
  const earliest = utcDate(first.date.getUTCFullYear(), first.date.getUTCMonth(), 1);
  if (earliest > last) return { month: last, earliest, last, early: true };
  let month = (param && parseMonthKey(param)) || last;
  if (month > last) month = last;
  if (month < earliest) month = earliest;
  return { month, earliest, last, early: false };
}

/** Everything the five steps of "Il caffè dei conti" need, and the decision log. */
export async function getMoneyTalk(householdId: string, param?: string) {
  const resolved = await resolveTalkMonth(householdId, param);
  if (!resolved) return null;
  const { month, earliest, last, early } = resolved;
  const next = utcDate(month.getUTCFullYear(), month.getUTCMonth() + 1, 1);
  const before = utcDate(month.getUTCFullYear(), month.getUTCMonth() - 1, 1);
  const t = todayInAppTimeZone();
  const today = utcDate(t.year, t.month, t.day);
  const todayIso = toDateInputValue(today);
  const shared = { householdId, type: "EXPENSE" as const, NOT: { tags: { has: PERSONAL_TAG } } };

  const [
    household,
    categories,
    expenses,
    previous,
    totals,
    monthExpenses,
    budgets,
    goals,
    split,
    bigExpenses,
    recurring,
    tariffs,
    talks,
    decisions,
  ] = await Promise.all([
    prisma.household.findUniqueOrThrow({
      where: { id: householdId },
      select: {
        splitMode: true,
        members: {
          orderBy: { joinedAt: "asc" },
          select: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    }),
    prisma.category.findMany({
      where: { householdId },
      select: { id: true, name: true, icon: true, color: true, parentId: true },
    }),
    prisma.transaction.findMany({
      where: { ...shared, date: { gte: month, lt: next } },
      select: { userId: true, baseAmount: true, categoryId: true },
    }),
    month > earliest
      ? prisma.transaction.groupBy({
          by: ["categoryId"],
          where: { ...shared, date: { gte: before, lt: month } },
          _sum: { baseAmount: true },
        })
      : Promise.resolve(null),
    prisma.transaction.groupBy({
      by: ["type"],
      where: { householdId, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: month, lt: next } },
      _sum: { baseAmount: true },
    }),
    // Budgets are monthly and count every expense of the month, like the budgets page.
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { householdId, type: "EXPENSE", date: { gte: month, lt: next } },
      _sum: { baseAmount: true },
    }),
    prisma.budget.findMany({
      where: { householdId },
      select: {
        amount: true,
        categoryId: true,
        category: { select: { name: true, children: { select: { id: true } } } },
      },
    }),
    prisma.goal.findMany({ where: { householdId } }),
    getSplit(householdId),
    prisma.bigExpense.findMany({
      where: { householdId },
      select: { name: true, amount: true, months: true, day: true, paidThrough: true },
    }),
    getRecurring(householdId),
    getTariffometro(householdId),
    prisma.moneyTalk.findMany({
      where: { householdId },
      orderBy: { month: "asc" },
      select: { month: true, heldAt: true, heldBy: { select: { name: true, email: true } } },
    }),
    prisma.moneyDecision.findMany({
      where: { householdId },
      orderBy: [{ month: "desc" }, { createdAt: "asc" }],
      take: 200,
      select: {
        id: true,
        month: true,
        topic: true,
        text: true,
        ownerId: true,
        dueOn: true,
        doneAt: true,
      },
    }),
  ]);

  const byId = new Map(categories.map((c) => [c.id, c]));
  const topOf = (id: string | null): TalkCategory | null => {
    let c = id ? byId.get(id) : undefined;
    while (c?.parentId && byId.has(c.parentId)) c = byId.get(c.parentId);
    return c ? { id: c.id, name: c.name, icon: c.icon, color: c.color } : null;
  };

  // The month before, rolled up to top categories like this month.
  let previousData = null;
  if (previous) {
    const byTop = new Map<string, TalkCategory & { amount: number }>();
    for (const r of previous) {
      const top = topOf(r.categoryId) ?? {
        id: "none",
        name: "Senza categoria",
        icon: null,
        color: null,
      };
      const current = byTop.get(top.id) ?? { ...top, amount: 0 };
      current.amount += Number(r._sum.baseAmount ?? 0);
      byTop.set(top.id, current);
    }
    previousData = { categories: Array.from(byTop.values()) };
  }

  const spentByCategory = new Map<string, number>();
  for (const s of monthExpenses) {
    if (s.categoryId) spentByCategory.set(s.categoryId, Number(s._sum.baseAmount ?? 0));
  }

  const members = household.members.map((m) => ({ id: m.user.id, name: firstName(m.user) }));
  const names = new Map(members.map((m) => [m.id, m.name]));
  const income = split.members.map((m) => ({
    userId: m.userId,
    name: m.name,
    income: m.income,
  }));

  // The decisions of the last talk before this month: the ones to look back on.
  const earlier = decisions.filter((d) => d.month < month);
  const lastMonth = earlier[0]?.month.getTime();
  const lastDecisions = earlier.filter((d) => d.month.getTime() === lastMonth);

  const monthStart = toDateInputValue(month);
  const until = toDateInputValue(new Date(today.getTime() + UPCOMING_DAYS * DAY_MS));
  const total = (type: string) => Number(totals.find((r) => r.type === type)?._sum.baseAmount ?? 0);

  const talk = buildTalk({
    members: income,
    splitMode: household.splitMode,
    expenses: expenses.map((e) => ({
      userId: e.userId,
      amount: Number(e.baseAmount),
      category: topOf(e.categoryId),
    })),
    previous: previousData,
    income: total("INCOME"),
    expense: total("EXPENSE"),
    budgets: budgets.map((b) => ({
      name: b.category.name,
      amount: Number(b.amount),
      spent: cents(
        [b.categoryId, ...b.category.children.map((c) => c.id)].reduce(
          (s, id) => s + (spentByCategory.get(id) ?? 0),
          0,
        ),
      ),
    })),
    goals: goals.map((g) => {
      const target = Number(g.targetAmount);
      const current = Number(g.currentAmount);
      const targetDate = g.targetDate ? toDateInputValue(g.targetDate) : null;
      return {
        id: g.id,
        name: g.name,
        icon: g.icon,
        color: g.color,
        target,
        current,
        targetDate,
        monthly: suggestedMonthlyContribution(current, target, g.targetDate, t),
        overdue: targetDate !== null && targetDate < todayIso && current < target,
        reachedLately: current >= target && dayInAppTimeZone(g.updatedAt) >= monthStart,
      };
    }),
    transfers: split.transfers.map((tr) => ({
      from: names.get(tr.fromUserId) ?? "Ex membro",
      to: names.get(tr.toUserId) ?? "Ex membro",
      amount: tr.amount,
    })),
    upcoming: bigExpenses.flatMap((b) => {
      const paidThrough = b.paidThrough ? toDateInputValue(b.paidThrough) : null;
      const schedule = { amount: Number(b.amount), months: b.months, day: b.day };
      return paymentDates(schedule, todayIso, until)
        .filter((date) => !paidThrough || date > paidThrough)
        .map((date) => ({ name: b.name, amount: paymentShare(schedule), date }));
    }),
    subscriptions: (() => {
      const list = cancellableSubscriptions(recurring, (id) => {
        const name = topOf(id)?.name;
        return name !== undefined && isNeed(name);
      });
      return { count: list.length, monthly: cents(list.reduce((s, x) => s + x.monthly, 0)) };
    })(),
    tariffs: tariffs.summary.above.map((a) => ({
      label: a.kind === "BANK_ACCOUNT" ? `Conto «${a.label}»` : a.label,
      over: a.over,
    })),
    lastDecisions: lastDecisions.map((d) => ({ done: d.doneAt !== null })),
  });

  const held = talks.find((x) => x.month.getTime() === month.getTime());
  const iso = (d: Date | null) => (d ? toDateInputValue(d) : null);

  return {
    month: monthKey(month),
    monthName: formatMonth(month),
    previousMonthName: formatMonth(before),
    nextMonthName: formatMonth(next),
    year: month.getUTCFullYear(),
    early,
    prev: month > earliest ? monthKey(before) : null,
    next: month < last ? monthKey(next) : null,
    /** When the next talk comes, for the latest month only: "novembre". */
    nextTalk:
      month.getTime() === last.getTime() ? formatMonth(utcDate(t.year, t.month + 1, 1)) : null,
    today: todayIso,
    talk,
    /** Split mode chosen, to word the rule; the one applied is in talk.contributions. */
    splitMode: household.splitMode,
    held: held
      ? {
          on: dayInAppTimeZone(held.heldAt),
          by: held.heldBy ? firstName(held.heldBy) : null,
        }
      : null,
    /** How many months the space has talked about, this one included if done. */
    talksHeld: talks.length,
    members,
    decisions: decisions.map((d) => ({
      id: d.id,
      month: monthKey(d.month),
      monthName: formatMonth(d.month),
      topic: d.topic,
      text: d.text,
      owner: d.ownerId ? { id: d.ownerId, name: names.get(d.ownerId) ?? "Ex membro" } : null,
      dueOn: iso(d.dueOn),
      done: d.doneAt !== null,
      /** Taken at the last talk before this month. */
      fromLastTalk: lastDecisions.some((x) => x.id === d.id),
    })),
  };
}

export type MoneyTalkPage = NonNullable<Awaited<ReturnType<typeof getMoneyTalk>>>;

/**
 * The talk about last month, when it's ready and not done yet: shared space, enough shared
 * expenses to talk about. For the dashboard and the weekly digest.
 */
export async function getTalkReminder(householdId: string) {
  const month = lastCompleteMonth();
  const next = utcDate(month.getUTCFullYear(), month.getUTCMonth() + 1, 1);
  const [members, held, count] = await Promise.all([
    prisma.householdMember.count({ where: { householdId } }),
    prisma.moneyTalk.findUnique({
      where: { householdId_month: { householdId, month } },
      select: { id: true },
    }),
    prisma.transaction.count({
      where: {
        householdId,
        type: "EXPENSE",
        NOT: { tags: { has: PERSONAL_TAG } },
        date: { gte: month, lt: next },
      },
    }),
  ]);
  if (members < 2 || held || count < REMINDER_MIN_EXPENSES) return null;
  return { key: monthKey(month), name: formatMonth(month) };
}
