import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { computeBalances } from "@/lib/finance/balances";

export async function getAccountsWithBalances(userId: string) {
  const [accounts, outgoing, incoming] = await Promise.all([
    prisma.financialAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.transaction.groupBy({
      by: ["accountId", "type"],
      where: { userId },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.groupBy({
      by: ["transferAccountId"],
      where: { userId, type: "TRANSFER" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const balances = computeBalances(
    accounts,
    outgoing.map((r) => ({ accountId: r.accountId, type: r.type, amount: r._sum.amount })),
    incoming.map((r) => ({ transferAccountId: r.transferAccountId, amount: r._sum.amount })),
  );

  const transactionCounts = new Map<string, number>();
  const bump = (accountId: string | null, n: number) => {
    if (accountId) transactionCounts.set(accountId, (transactionCounts.get(accountId) ?? 0) + n);
  };
  outgoing.forEach((r) => bump(r.accountId, r._count._all));
  incoming.forEach((r) => bump(r.transferAccountId, r._count._all));

  return accounts.map((account) => ({
    ...account,
    balance: balances.get(account.id) ?? new Prisma.Decimal(0),
    transactionCount: transactionCounts.get(account.id) ?? 0,
  }));
}

export type AccountWithBalance = Awaited<ReturnType<typeof getAccountsWithBalances>>[number];

export function getAccountOptions(userId: string) {
  return prisma.financialAccount.findMany({
    where: { userId },
    select: { id: true, name: true, type: true },
    orderBy: { createdAt: "asc" },
  });
}
