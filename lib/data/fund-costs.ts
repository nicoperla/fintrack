import { prisma } from "@/lib/db/prisma";
import { getInvestments } from "@/lib/data/investments";
import { FUND_CATEGORIES, type FundCategory } from "@/lib/finance/fund-costs";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * The investment accounts with the costs entered from their KID, their value today and what goes
 * in every month (as entered, or the average of the last twelve months of transfers).
 */
export async function getFundCosts(householdId: string) {
  const t = todayInAppTimeZone();
  const yearAgo = utcDate(t.year, t.month - 12, 1);
  const monthStart = utcDate(t.year, t.month, 1);
  const investments = await getInvestments(householdId);
  const ids = investments.accounts.map((a) => a.id);

  const [costs, transfers] = await Promise.all([
    prisma.investmentCost.findMany({ where: { householdId, accountId: { in: ids } } }),
    prisma.transaction.findMany({
      where: {
        householdId,
        type: "TRANSFER",
        date: { gte: yearAgo, lt: monthStart },
        OR: [{ accountId: { in: ids } }, { transferAccountId: { in: ids } }],
      },
      select: {
        date: true,
        accountId: true,
        transferAccountId: true,
        amount: true,
        transferAmount: true,
      },
    }),
  ]);

  // What went in, minus what came out, over the last twelve complete months (or since the first
  // transfer, for an account tracked for less than a year).
  const paidIn = new Map<string, number>();
  const firstMonth = new Map<string, Date>();
  const seen = (id: string, date: Date) => {
    const month = utcDate(date.getUTCFullYear(), date.getUTCMonth(), 1);
    const known = firstMonth.get(id);
    if (!known || month < known) firstMonth.set(id, month);
  };
  for (const tx of transfers) {
    seen(tx.accountId, tx.date);
    if (tx.transferAccountId) seen(tx.transferAccountId, tx.date);
    if (tx.transferAccountId && ids.includes(tx.transferAccountId)) {
      const amount = Number(tx.transferAmount ?? tx.amount);
      paidIn.set(tx.transferAccountId, (paidIn.get(tx.transferAccountId) ?? 0) + amount);
    }
    if (ids.includes(tx.accountId)) {
      paidIn.set(tx.accountId, (paidIn.get(tx.accountId) ?? 0) - Number(tx.amount));
    }
  }

  return {
    accounts: investments.accounts.map((a) => {
      const c = costs.find((x) => x.accountId === a.id);
      const since = firstMonth.get(a.id);
      const months = since
        ? Math.min(
            12,
            (monthStart.getUTCFullYear() - since.getUTCFullYear()) * 12 +
              monthStart.getUTCMonth() -
              since.getUTCMonth(),
          )
        : 12;
      const usual = Math.max(0, cents((paidIn.get(a.id) ?? 0) / Math.max(1, months)));
      return {
        id: a.id,
        name: a.name,
        currency: a.currency,
        value: a.value,
        valuedAt: a.valuedAt,
        stale: a.stale,
        /** What goes in every month: the figure entered, or the usual one. */
        usualMonthly: usual,
        costs: c
          ? {
              category: (FUND_CATEGORIES.includes(c.category as FundCategory)
                ? c.category
                : "other") as FundCategory,
              entry: Number(c.entryPct),
              exit: Number(c.exitPct),
              ongoing: Number(c.ongoingPct),
              transaction: Number(c.transactionPct),
              performance: Number(c.performancePct),
              monthly: c.monthly === null ? null : Number(c.monthly),
            }
          : null,
      };
    }),
  };
}

export type FundCostsPage = Awaited<ReturnType<typeof getFundCosts>>;
export type FundCostAccount = FundCostsPage["accounts"][number];
