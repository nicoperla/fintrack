import { Prisma, type TransactionType } from "@prisma/client";

type AccountBase = { id: string; initialBalance: Prisma.Decimal };
type OutgoingSum = { accountId: string; type: TransactionType; amount: Prisma.Decimal | null };
type IncomingTransferSum = { transferAccountId: string | null; amount: Prisma.Decimal | null };

/**
 * balance = initialBalance + income - expenses - transfers out + transfers in.
 * Inputs are per-account sums (from groupBy), so this stays O(accounts) regardless of history size.
 */
export function computeBalances(
  accounts: AccountBase[],
  outgoing: OutgoingSum[],
  incomingTransfers: IncomingTransferSum[],
): Map<string, Prisma.Decimal> {
  const balances = new Map(accounts.map((a) => [a.id, new Prisma.Decimal(a.initialBalance)]));

  for (const row of outgoing) {
    const current = balances.get(row.accountId);
    if (!current || !row.amount) continue;
    const delta = row.type === "INCOME" ? row.amount : row.amount.negated();
    balances.set(row.accountId, current.plus(delta));
  }

  for (const row of incomingTransfers) {
    if (!row.transferAccountId || !row.amount) continue;
    const current = balances.get(row.transferAccountId);
    if (current) balances.set(row.transferAccountId, current.plus(row.amount));
  }

  return balances;
}
