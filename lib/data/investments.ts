import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { getAccountsWithBalances } from "@/lib/data/accounts";
import { latestConverter } from "@/lib/currency/rates";
import { CurrencyError } from "@/lib/currency/convert";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";
import {
  investmentPosition,
  investmentSeries,
  sumSeries,
  type InvestmentMovement,
} from "@/lib/finance/investments";

/** After this many days without a new value, the app suggests entering one. */
export const STALE_AFTER_DAYS = 30;

const DAY_MS = 86_400_000;

/**
 * The investment accounts (type INVESTMENT), apart from the money you can spend: what was put
 * in, what it's worth and the gain, per account and in total, plus the day-by-day history. Totals
 * are in the space currency at today's rate, like the account balances.
 */
export const getInvestments = cache(async (householdId: string) => {
  const t = todayInAppTimeZone();
  const today = toDateInputValue(utcDate(t.year, t.month, t.day));
  const [household, all] = await Promise.all([
    prisma.household.findUniqueOrThrow({ where: { id: householdId }, select: { currency: true } }),
    getAccountsWithBalances(householdId),
  ]);
  const base = household.currency;
  const accounts = all.filter((a) => a.type === "INVESTMENT");
  if (accounts.length === 0) {
    return { currency: base, accounts: [], total: null, series: [], staleCount: 0 };
  }

  const ids = accounts.map((a) => a.id);
  const [transactions, valuations, converter] = await Promise.all([
    prisma.transaction.findMany({
      where: { householdId, OR: [{ accountId: { in: ids } }, { transferAccountId: { in: ids } }] },
      select: {
        date: true,
        type: true,
        amount: true,
        transferAmount: true,
        accountId: true,
        transferAccountId: true,
      },
    }),
    prisma.investmentValuation.findMany({
      where: { householdId, accountId: { in: ids } },
      orderBy: { date: "desc" },
      select: { id: true, accountId: true, date: true, value: true },
    }),
    latestConverter([base, ...accounts.map((a) => a.currency)]),
  ]);

  const movements = new Map<string, InvestmentMovement[]>(ids.map((id) => [id, []]));
  for (const tx of transactions) {
    const date = toDateInputValue(tx.date);
    const amount = tx.amount.toNumber();
    const from = movements.get(tx.accountId);
    if (from) {
      // Transfers take money out; income and expenses on the account are dividends and fees.
      if (tx.type === "TRANSFER") from.push({ date, amount: -amount, kind: "contribution" });
      else from.push({ date, amount: tx.type === "INCOME" ? amount : -amount, kind: "return" });
    }
    const to =
      tx.type === "TRANSFER" && tx.transferAccountId && movements.get(tx.transferAccountId);
    if (to) {
      // Between currencies the destination receives transfer_amount, in its own currency.
      to.push({ date, amount: (tx.transferAmount ?? tx.amount).toNumber(), kind: "contribution" });
    }
  }

  const toBase = (value: number, currency: string) => {
    try {
      return converter.convert(value, currency, base, today);
    } catch (error) {
      if (error instanceof CurrencyError) return 0;
      throw error;
    }
  };

  // The history starts with the oldest account, movement or value. Every account is in it from
  // that day with its opening balance (money it already had when tracking began), so an account
  // whose first movement comes later doesn't show up as a sudden jump.
  const start = [
    ...accounts.map((a) => toDateInputValue(a.createdAt)),
    ...transactions.map((t) => toDateInputValue(t.date)),
    ...valuations.map((v) => toDateInputValue(v.date)),
  ]
    .filter((d) => d <= today)
    .sort()[0];

  // Accounts come in creation order: that order fixes each one's colour.
  const computed = accounts.map((account, slot) => {
    const own = valuations
      .filter((v) => v.accountId === account.id)
      .map((v) => ({ id: v.id, date: toDateInputValue(v.date), value: v.value.toNumber() }));
    const list = movements.get(account.id)!;
    const opening = account.initialBalance.toNumber();
    const position = investmentPosition(opening, list, own);
    const series = investmentSeries(opening, list, own, start, today).map((p) => ({
      date: p.date,
      invested: toBase(p.invested, account.currency),
      value: toBase(p.value, account.currency),
    }));
    const stale =
      !position.valuedAt ||
      (Date.parse(today) - Date.parse(position.valuedAt)) / DAY_MS > STALE_AFTER_DAYS;
    const row = {
      id: account.id,
      slot,
      name: account.name,
      currency: account.currency,
      transactionCount: account.transactionCount,
      ...position,
      baseValue: toBase(position.value, account.currency),
      baseInvested: toBase(position.invested, account.currency),
      baseGain: toBase(position.gain, account.currency),
      stale,
      valuations: own,
    };
    return { row, series };
  });
  const rows = computed.map((c) => c.row);

  const value = rows.reduce((s, r) => s + r.baseValue, 0);
  const invested = rows.reduce((s, r) => s + r.baseInvested, 0);
  const gain = value - invested;

  return {
    currency: base,
    accounts: rows
      .map((row) => ({ ...row, share: value > 0 ? row.baseValue / value : 0 }))
      .sort((a, b) => b.baseValue - a.baseValue),
    total: { value, invested, gain, gainPct: invested > 0 ? gain / invested : null },
    series: sumSeries(computed.map((c) => c.series)),
    staleCount: rows.filter((r) => r.stale).length,
  };
});

export type Investments = Awaited<ReturnType<typeof getInvestments>>;
export type InvestmentAccount = Investments["accounts"][number];
