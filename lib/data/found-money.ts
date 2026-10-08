import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { getRecurring } from "@/lib/data/intelligence";
import { hasPro } from "@/lib/billing/plan";
import { isNeed } from "@/lib/finance/coach";
import { summarizeDeductions } from "@/lib/finance/deductions";
import {
  cancellableSubscriptions,
  findBankFees,
  findDuplicates,
  findPriceIncreases,
  findRenewals,
  type FoundTx,
} from "@/lib/finance/found-money";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

const DAY_MS = 86_400_000;
const DUPLICATE_WINDOW_DAYS = 90;
const cents = (n: number) => Math.round(n * 100) / 100;

/** The tax year shown: the one asked for if valid, otherwise the current one. */
function resolveYear(param: string | undefined, current: number, first: number) {
  const year = Number(param);
  return Number.isInteger(year) && year >= first && year <= current ? year : current;
}

/** Everything "Soldi ritrovati" found in the space, with the details (Pro only). */
export const getFoundMoney = cache(
  async (userId: string, householdId: string, yearParam?: string) => {
    const t = todayInAppTimeZone();
    const todayDate = utcDate(t.year, t.month, t.day);
    const today = toDateInputValue(todayDate);

    const [user, household, first] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { dependentChildren: true, plan: true },
      }),
      prisma.household.findUniqueOrThrow({
        where: { id: householdId },
        select: {
          currency: true,
          members: {
            orderBy: { joinedAt: "asc" },
            select: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      }),
      prisma.transaction.findFirst({
        where: { householdId },
        orderBy: { date: "asc" },
        select: { date: true },
      }),
    ]);
    const firstYear = first?.date.getUTCFullYear() ?? t.year;
    const year = resolveYear(yearParam, t.year, firstYear);

    const [yearTx, recentTx, recurring, dismissals, categories] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          householdId,
          type: "EXPENSE",
          date: { gte: utcDate(year, 0, 1), lt: utcDate(year + 1, 0, 1) },
        },
        select: {
          id: true,
          date: true,
          description: true,
          baseAmount: true,
          userId: true,
          deduction: true,
          account: { select: { name: true, type: true } },
          category: { select: { name: true, parent: { select: { name: true } } } },
        },
      }),
      // From the start of the month a year ago: the bank fees count whole months.
      prisma.transaction.findMany({
        where: {
          householdId,
          type: "EXPENSE",
          date: { gte: utcDate(t.year, t.month - 12, 1), lte: todayDate },
        },
        select: {
          id: true,
          date: true,
          description: true,
          baseAmount: true,
          accountId: true,
          account: { select: { name: true } },
          category: { select: { name: true } },
        },
      }),
      getRecurring(householdId),
      prisma.foundMoneyDismissal.findMany({ where: { householdId }, select: { key: true } }),
      prisma.category.findMany({
        where: { householdId },
        select: { id: true, name: true, parentId: true },
      }),
    ]);

    const dismissed = new Set(dismissals.map((d) => d.key));
    const children = user.dependentChildren;

    const deductions = summarizeDeductions(
      yearTx.map((tx) => ({
        id: tx.id,
        date: toDateInputValue(tx.date),
        description: tx.description,
        amount: Number(tx.baseAmount),
        account: tx.account.name,
        accountType: tx.account.type,
        memberId: tx.userId,
        category: tx.category?.name ?? null,
        parent: tx.category?.parent?.name ?? null,
        override: tx.deduction,
      })),
      children,
    );

    const recent: FoundTx[] = recentTx.map((tx) => ({
      id: tx.id,
      date: toDateInputValue(tx.date),
      description: tx.description,
      amount: Number(tx.baseAmount),
      accountId: tx.accountId,
      account: tx.account.name,
      category: tx.category?.name ?? null,
    }));
    const duplicateSince = toDateInputValue(
      new Date(todayDate.getTime() - DUPLICATE_WINDOW_DAYS * DAY_MS),
    );
    const duplicates = findDuplicates(
      recent.filter((tx) => tx.date >= duplicateSince),
      dismissed,
    );
    const priceIncreases = findPriceIncreases(recurring, dismissed);
    const renewals = findRenewals(recurring, today, dismissed);
    const bankFees = findBankFees(
      recent,
      today,
      first ? toDateInputValue(first.date) : null,
      dismissed,
    );

    // Rent, bills, insurance… are recurring too, but nobody writes them a cancellation letter.
    const byId = new Map(categories.map((c) => [c.id, c]));
    const topName = (id: string | null) => {
      let c = id ? byId.get(id) : undefined;
      while (c?.parentId && byId.has(c.parentId)) c = byId.get(c.parentId);
      return c?.name ?? null;
    };
    const subscriptions = cancellableSubscriptions(recurring, (id) => {
      const name = topName(id);
      return name !== null && isNeed(name);
    });

    const sum = (values: number[]) => cents(values.reduce((s, v) => s + v, 0));
    const summary = {
      refund: deductions.refund,
      lostToCash: deductions.lostToCash,
      toCheck: deductions.toCheck,
      byType: deductions.byType,
      members: household.members.map((m) => ({
        id: m.user.id,
        name: m.user.name?.split(" ")[0] || m.user.email.split("@")[0],
        isYou: m.user.id === userId,
        refund: deductions.members.find((x) => x.memberId === m.user.id)?.refund ?? 0,
      })),
      duplicates: { count: duplicates.length, total: sum(duplicates.map((d) => d.amount)) },
      priceIncreases: {
        count: priceIncreases.length,
        yearly: sum(priceIncreases.map((p) => p.yearly)),
      },
      renewals: { count: renewals.length, total: sum(renewals.map((r) => r.amount)) },
      bankFees: bankFees ? { yearly: bankFees.yearly } : null,
      subscriptions: {
        count: subscriptions.length,
        yearly: sum(subscriptions.map((s) => s.yearly)),
      },
    };
    const total = sum([
      summary.refund,
      summary.duplicates.total,
      summary.renewals.total,
      summary.priceIncreases.yearly,
      summary.bankFees?.yearly ?? 0,
    ]);

    const unlocked = hasPro(user);
    return {
      year,
      currentYear: t.year,
      years: Array.from({ length: t.year - firstYear + 1 }, (_, i) => firstYear + i),
      today,
      currency: household.currency,
      children,
      shared: household.members.length > 1,
      total,
      summary,
      // Without Pro the details never leave the server: only the totals above.
      details: unlocked
        ? {
            lines: deductions.lines,
            duplicates,
            priceIncreases,
            renewals,
            bankFees,
            subscriptions,
          }
        : null,
    };
  },
);

export type FoundMoney = Awaited<ReturnType<typeof getFoundMoney>>;
