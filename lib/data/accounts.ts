import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { computeBalances } from "@/lib/finance/balances";
import { latestConverter } from "@/lib/currency/rates";
import { CurrencyError } from "@/lib/currency/convert";

/**
 * Accounts with their balance in their own currency, and `baseBalance` converted to the space's
 * currency at today's rate (what net worth adds up).
 */
export const getAccountsWithBalances = cache(async (householdId: string) => {
  const [household, accounts, outgoing, incoming] = await Promise.all([
    prisma.household.findUniqueOrThrow({ where: { id: householdId }, select: { currency: true } }),
    prisma.financialAccount.findMany({ where: { householdId }, orderBy: { createdAt: "asc" } }),
    prisma.transaction.groupBy({
      by: ["accountId", "type"],
      where: { householdId },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // Between currencies the destination receives transfer_amount, in its own currency.
    prisma.$queryRaw<{ transfer_account_id: string; amount: Prisma.Decimal; count: bigint }[]>`
      SELECT "transfer_account_id", SUM(COALESCE("transfer_amount", "amount")) AS amount, COUNT(*) AS count
      FROM "transactions"
      WHERE "household_id" = ${householdId} AND "type"::text = 'TRANSFER'
      GROUP BY 1`,
  ]);

  const balances = computeBalances(
    accounts,
    outgoing.map((r) => ({ accountId: r.accountId, type: r.type, amount: r._sum.amount })),
    incoming.map((r) => ({ transferAccountId: r.transfer_account_id, amount: r.amount })),
  );

  const transactionCounts = new Map<string, number>();
  const bump = (accountId: string | null, n: number) => {
    if (accountId) transactionCounts.set(accountId, (transactionCounts.get(accountId) ?? 0) + n);
  };
  outgoing.forEach((r) => bump(r.accountId, r._count._all));
  incoming.forEach((r) => bump(r.transfer_account_id, Number(r.count)));

  const base = household.currency;
  const converter = await latestConverter([base, ...accounts.map((a) => a.currency)]);
  const today = new Date();

  return accounts.map((account) => {
    const balance = balances.get(account.id) ?? new Prisma.Decimal(0);
    // Without any known rate (API unreachable on first use) the account counts as zero.
    const toBase = (value: Prisma.Decimal) => {
      try {
        return converter.convert(value.toNumber(), account.currency, base, today);
      } catch (error) {
        if (error instanceof CurrencyError) return 0;
        throw error;
      }
    };
    return {
      ...account,
      balance,
      transactionCount: transactionCounts.get(account.id) ?? 0,
      baseBalance: toBase(balance),
      baseInitialBalance: toBase(account.initialBalance),
    };
  });
});

export type AccountWithBalance = Awaited<ReturnType<typeof getAccountsWithBalances>>[number];

export function getAccountOptions(householdId: string) {
  return prisma.financialAccount.findMany({
    where: { householdId },
    select: { id: true, name: true, type: true, currency: true },
    orderBy: { createdAt: "asc" },
  });
}
