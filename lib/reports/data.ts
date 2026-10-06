import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getAccountsWithBalances } from "@/lib/data/accounts";
import { getInvestments } from "@/lib/data/investments";
import { summarizeByTopCategory } from "@/lib/finance/dashboard-math";
import { budgetUsage } from "@/lib/finance/planning";
import { formatMonthShort, formatMonthYear, todayInAppTimeZone, utcDate } from "@/lib/dates";
import { ACCOUNT_TYPES, isInvestment } from "@/lib/account-types";

export type ReportPeriod =
  { kind: "month"; year: number; month: number } | { kind: "year"; year: number };

/** Parses "?period=month&month=2026-08" or "?period=year&year=2026". */
export function parseReportPeriod(params: URLSearchParams): ReportPeriod | null {
  if (params.get("period") === "year") {
    const year = Number(params.get("year"));
    return Number.isInteger(year) && year >= 1970 && year <= 2100 ? { kind: "year", year } : null;
  }
  const match = params.get("month")?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const month = Number(match[2]) - 1;
  return month >= 0 && month < 12 ? { kind: "month", year: Number(match[1]), month } : null;
}

function range(period: ReportPeriod) {
  return period.kind === "month"
    ? {
        start: utcDate(period.year, period.month, 1),
        end: utcDate(period.year, period.month + 1, 1),
        previousStart: utcDate(period.year, period.month - 1, 1),
        label: formatMonthYear(utcDate(period.year, period.month, 1)),
        previousLabel: formatMonthYear(utcDate(period.year, period.month - 1, 1)),
        fileSuffix: `${period.year}-${String(period.month + 1).padStart(2, "0")}`,
      }
    : {
        start: utcDate(period.year, 0, 1),
        end: utcDate(period.year + 1, 0, 1),
        previousStart: utcDate(period.year - 1, 0, 1),
        label: String(period.year),
        previousLabel: String(period.year - 1),
        fileSuffix: String(period.year),
      };
}

/** Months of `year` shown in the yearly report: all of them, except for the year in progress. */
function monthsElapsed(year: number) {
  const today = todayInAppTimeZone();
  return year < today.year ? 12 : year === today.year ? today.month + 1 : 0;
}

const sumByType = (
  rows: { type: string; _sum: { baseAmount: Prisma.Decimal | null } }[],
  type: string,
) => Number(rows.find((r) => r.type === type)?._sum.baseAmount ?? 0);

export async function getReportData(
  space: { id: string; name: string; currency: string },
  period: ReportPeriod,
) {
  const householdId = space.id;
  const r = range(period);
  const inRange = { gte: r.start, lt: r.end };

  const [
    totals,
    previousTotals,
    categories,
    expenseSums,
    incomeSums,
    biggest,
    monthly,
    budgets,
    accounts,
    investments,
  ] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["type"],
      where: { householdId, type: { in: ["INCOME", "EXPENSE"] }, date: inRange },
      _sum: { baseAmount: true },
      _count: { _all: true },
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      where: {
        householdId,
        type: { in: ["INCOME", "EXPENSE"] },
        date: { gte: r.previousStart, lt: r.start },
      },
      _sum: { baseAmount: true },
    }),
    prisma.category.findMany({
      where: { householdId },
      select: { id: true, name: true, color: true, parentId: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { householdId, type: "EXPENSE", date: inRange },
      _sum: { baseAmount: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { householdId, type: "INCOME", date: inRange },
      _sum: { baseAmount: true },
    }),
    prisma.transaction.findMany({
      where: { householdId, type: "EXPENSE", date: inRange },
      orderBy: { baseAmount: "desc" },
      take: 8,
      select: {
        date: true,
        description: true,
        amount: true,
        baseAmount: true,
        category: { select: { name: true } },
        account: { select: { name: true, currency: true } },
      },
    }),
    period.kind === "year"
      ? prisma.$queryRaw<
          { month: Date; income: Prisma.Decimal | null; expense: Prisma.Decimal | null }[]
        >`
            SELECT date_trunc('month', "date")::date AS month,
              SUM(CASE WHEN "type"::text = 'INCOME' THEN "base_amount" END) AS income,
              SUM(CASE WHEN "type"::text = 'EXPENSE' THEN "base_amount" END) AS expense
            FROM "transactions"
            WHERE "household_id" = ${householdId} AND "type"::text IN ('INCOME', 'EXPENSE')
              AND "date" >= ${r.start}::date AND "date" < ${r.end}::date
            GROUP BY 1 ORDER BY 1`
      : Promise.resolve([]),
    period.kind === "month"
      ? prisma.budget.findMany({
          where: { householdId },
          select: {
            categoryId: true,
            amount: true,
            alertThreshold: true,
            category: { select: { name: true, children: { select: { id: true } } } },
          },
        })
      : Promise.resolve([]),
    getAccountsWithBalances(householdId),
    getInvestments(householdId),
  ]);
  const positions = new Map(investments.accounts.map((a) => [a.id, a]));

  const income = sumByType(totals, "INCOME");
  const expense = sumByType(totals, "EXPENSE");
  const count = totals.reduce((s, t) => s + t._count._all, 0);
  const toSums = (
    rows: { categoryId: string | null; _sum: { baseAmount: Prisma.Decimal | null } }[],
  ) =>
    rows.map((row) => ({ categoryId: row.categoryId, amount: Number(row._sum.baseAmount ?? 0) }));

  const spentByCategory = new Map(
    expenseSums.map((s) => [s.categoryId, Number(s._sum.baseAmount ?? 0)]),
  );

  return {
    title: period.kind === "month" ? "Report mensile" : "Report annuale",
    label: r.label,
    previousLabel: r.previousLabel,
    fileName: `fintrack-report-${r.fileSuffix}.pdf`,
    kind: period.kind,
    owner: space.name,
    currency: space.currency,
    generatedAt: new Date(),
    count,
    income,
    expense,
    net: income - expense,
    savingsRate: income > 0 ? (income - expense) / income : null,
    previous: {
      income: sumByType(previousTotals, "INCOME"),
      expense: sumByType(previousTotals, "EXPENSE"),
    },
    expenseCategories: summarizeByTopCategory(toSums(expenseSums), categories, 10),
    incomeCategories: summarizeByTopCategory(toSums(incomeSums), categories, 6),
    biggest: biggest.map((b) => ({
      date: b.date,
      description: b.description,
      amount: Number(b.baseAmount),
      /** Set when the expense was in another currency. */
      original:
        b.account.currency !== space.currency
          ? { amount: Number(b.amount), currency: b.account.currency }
          : null,
      category: b.category?.name ?? "Senza categoria",
      account: b.account.name,
    })),
    months:
      period.kind === "year"
        ? Array.from({ length: monthsElapsed(period.year) }, (_, month) => {
            const row = monthly.find((m) => m.month.getUTCMonth() === month);
            const monthIncome = Number(row?.income ?? 0);
            const monthExpense = Number(row?.expense ?? 0);
            return {
              label: formatMonthShort(utcDate(period.year, month, 1)),
              income: monthIncome,
              expense: monthExpense,
              net: monthIncome - monthExpense,
              hasData: row !== undefined,
            };
          })
        : [],
    budgets: budgets.map((b) => {
      const ids = [b.categoryId, ...b.category.children.map((c) => c.id)];
      const spent = ids.reduce((s, id) => s + (spentByCategory.get(id) ?? 0), 0);
      return {
        name: b.category.name,
        spent,
        amount: Number(b.amount),
        ...budgetUsage(spent, Number(b.amount), b.alertThreshold),
      };
    }),
    // Investments at what they're worth, apart from the money you can spend.
    accounts: accounts.map((a) => {
      const position = isInvestment(a.type) ? positions.get(a.id) : undefined;
      return {
        name: a.name,
        type: ACCOUNT_TYPES[a.type].label,
        investment: !!position,
        balance: position ? position.value : a.balance.toNumber(),
        currency: a.currency,
        baseBalance: position ? position.baseValue : a.baseBalance,
        gain: position ? position.gain : null,
      };
    }),
    investments: investments.total,
  };
}

export type ReportData = Awaited<ReturnType<typeof getReportData>>;
