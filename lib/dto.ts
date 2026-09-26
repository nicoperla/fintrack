import type { AccountType, TransactionType } from "@prisma/client";
import type { AccountWithBalance } from "@/lib/data/accounts";
import type { CategoryNode } from "@/lib/data/categories";
import type { TransactionListItem } from "@/lib/data/transactions";
import { toDateInputValue } from "@/lib/format";

// Plain, serializable shapes passed from server components to client components (no Decimal/Date).

export type AccountDTO = {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: string;
  balance: string;
  /** Balance in the space currency at today's rate (equal to balance for same-currency accounts). */
  baseBalance: number;
  currency: string;
  transactionCount: number;
};

export function toAccountDTO(a: AccountWithBalance): AccountDTO {
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    initialBalance: a.initialBalance.toFixed(2),
    balance: a.balance.toFixed(2),
    baseBalance: a.baseBalance,
    currency: a.currency,
    transactionCount: a.transactionCount,
  };
}

export type AccountOption = { id: string; name: string; type: AccountType; currency: string };

export type CategoryOption = {
  id: string;
  name: string;
  type: TransactionType;
  icon: string | null;
  color: string | null;
  children: { id: string; name: string; icon: string | null; color: string | null }[];
};

export function toCategoryOptions(roots: CategoryNode[]): CategoryOption[] {
  return roots.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    icon: c.icon,
    color: c.color,
    children: c.children.map((ch) => ({
      id: ch.id,
      name: ch.name,
      icon: ch.icon,
      color: ch.color,
    })),
  }));
}

export type TransactionDTO = {
  id: string;
  type: TransactionType;
  /** In the account's currency. */
  amount: string;
  /** In the space currency. */
  baseAmount: string;
  /** Cross-currency transfers: what the destination received, in its currency. */
  transferAmount: string | null;
  date: string;
  description: string;
  notes: string | null;
  tags: string[];
  account: { id: string; name: string; currency: string };
  transferAccount: { id: string; name: string; currency: string } | null;
  /** Who recorded it (shown in shared spaces). */
  author: string | null;
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    parentName: string | null;
  } | null;
};

export function toTransactionDTO(t: TransactionListItem): TransactionDTO {
  return {
    id: t.id,
    type: t.type,
    amount: t.amount.toFixed(2),
    baseAmount: t.baseAmount.toFixed(2),
    transferAmount: t.transferAmount?.toFixed(2) ?? null,
    date: toDateInputValue(t.date),
    description: t.description,
    notes: t.notes,
    tags: t.tags,
    account: t.account,
    transferAccount: t.transferAccount,
    author: t.user ? (t.user.name ?? t.user.email.split("@")[0]) : null,
    category: t.category
      ? {
          id: t.category.id,
          name: t.category.name,
          icon: t.category.icon,
          color: t.category.color,
          parentName: t.category.parent?.name ?? null,
        }
      : null,
  };
}
