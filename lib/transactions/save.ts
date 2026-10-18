import { prisma } from "@/lib/db/prisma";
import { type ActionResult, validationError } from "@/lib/action-result";
import { type TransactionInput, transactionSchema } from "@/lib/validations/finance";
import { getBudgetWarnings } from "@/lib/data/budgets";
import { currentMonth } from "@/lib/dates";
import { CurrencyError } from "@/lib/currency/convert";
import { createConverter } from "@/lib/currency/rates";
import { classifyDeduction, inferDeduction, refundOf, RULES } from "@/lib/finance/deductions";
import { crossingNote } from "@/lib/tax/alerts";
import { formatCurrency, toDateInputValue } from "@/lib/format";
import { utcDate } from "@/lib/dates";

type SpaceRef = { id: string; currency: string; userId: string };

const NOT_FOUND: ActionResult = { ok: false, error: "Transazione non trovata." };

/** Checks that accounts and category belong to the space, and returns the accounts' currencies. */
async function checkOwnership(
  householdId: string,
  data: TransactionInput,
): Promise<
  | { error: ActionResult }
  | {
      currencies: Map<string, string>;
      accountTypes: Map<string, string>;
      category: { name: string; parent: string | null } | null;
    }
> {
  const accountIds = [data.accountId, data.transferAccountId].filter((v): v is string => !!v);
  const accounts = await prisma.financialAccount.findMany({
    where: { householdId, id: { in: accountIds } },
    select: { id: true, currency: true, type: true },
  });
  if (accounts.length !== accountIds.length) {
    return { error: { ok: false, fieldErrors: { accountId: ["Conto non valido"] } } };
  }

  let categoryNames: { name: string; parent: string | null } | null = null;
  if (data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, householdId },
      select: { type: true, name: true, parent: { select: { name: true } } },
    });
    if (!category) {
      return { error: { ok: false, fieldErrors: { categoryId: ["Categoria non valida"] } } };
    }
    categoryNames = { name: category.name, parent: category.parent?.name ?? null };
    if (category.type !== data.type) {
      return {
        error: {
          ok: false,
          fieldErrors: {
            categoryId: [
              data.type === "INCOME"
                ? "Scegli una categoria di entrata"
                : "Scegli una categoria di uscita",
            ],
          },
        },
      };
    }
  }
  return {
    currencies: new Map(accounts.map((a) => [a.id, a.currency])),
    accountTypes: new Map(accounts.map((a) => [a.id, a.type])),
    category: categoryNames,
  };
}

/**
 * The amount in the space's currency (what every total sums), and for transfers between
 * currencies what the destination receives: typed by the user, or converted at the day's rate.
 */
async function withConvertedAmounts(
  space: SpaceRef,
  data: TransactionInput,
  currencies: Map<string, string>,
) {
  const from = currencies.get(data.accountId)!;
  const to = data.transferAccountId ? currencies.get(data.transferAccountId)! : from;
  const amount = Number(data.amount);
  const converter = await createConverter([from, to, space.currency], data.date, data.date);

  const baseAmount = converter.convert(amount, from, space.currency, data.date);
  const crossCurrency = data.type === "TRANSFER" && to !== from;
  return {
    ...data,
    baseAmount: baseAmount.toFixed(2),
    transferAmount: crossCurrency
      ? (data.transferAmount ?? converter.convert(amount, from, to, data.date).toFixed(2))
      : null,
  };
}

/**
 * Validates and stores a movement in a space (creating it when `id` is null). Shared by the
 * server action and the API the offline outbox syncs through. Callers revalidate.
 */
export async function saveTransactionInSpace(
  space: SpaceRef,
  id: string | null,
  input: unknown,
): Promise<ActionResult & { id?: string }> {
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const ownership = await checkOwnership(space.id, parsed.data);
  if ("error" in ownership) return ownership.error;

  let data;
  try {
    data = await withConvertedAmounts(space, parsed.data, ownership.currencies);
  } catch (error) {
    if (error instanceof CurrencyError) return { ok: false, error: error.message };
    throw error;
  }

  let savedId = id;
  if (id) {
    const { count } = await prisma.transaction.updateMany({
      where: { id, householdId: space.id },
      data,
    });
    if (count === 0) return NOT_FOUND;
  } else {
    const created = await prisma.transaction.create({
      data: { ...data, householdId: space.id, userId: space.userId },
      select: { id: true },
    });
    savedId = created.id;
  }

  const { start, end } = currentMonth();
  const affectsCurrentBudgets =
    data.type === "EXPENSE" && data.categoryId && data.date >= start && data.date < end;
  const warnings = affectsCurrentBudgets ? await getBudgetWarnings(space.id, data.categoryId!) : [];

  // "Soldi ritrovati": a deductible expense paid in cash is a refund lost. Say so right away,
  // while there's still time to pay the next one by card.
  if (data.type === "EXPENSE" && ownership.accountTypes.get(data.accountId) === "CASH") {
    const deduction = inferDeduction({
      category: ownership.category?.name ?? null,
      parent: ownership.category?.parent ?? null,
      description: data.description,
    });
    if (
      deduction?.confidence === "sure" &&
      RULES[deduction.type].traceable &&
      !deduction.cashAllowed
    ) {
      warnings.push(
        `Pagata in contanti: per il 730 non è detraibile. Con carta o bancomat avresti recuperato circa ${formatCurrency(refundOf(Number(data.baseAmount), deduction.type))}.`,
      );
    }
  }
  if (data.type === "EXPENSE" && savedId) {
    const note = await crossing730(space, savedId, data, {
      accountType: ownership.accountTypes.get(data.accountId) ?? "CHECKING",
      category: ownership.category,
    });
    if (note) warnings.push(note);
  }
  return { ok: true, warnings, id: savedId ?? undefined };
}

/**
 * "Il mio 730": a deductible expense that crosses the franchigia (from here on it pays back) or
 * the yearly limit (the next ones won't) is worth a word while recording it. Only for the
 * person's own expenses, like the 730.
 */
async function crossing730(
  space: SpaceRef,
  savedId: string,
  data: { date: Date; description: string; baseAmount: string },
  saved: { accountType: string; category: { name: string; parent: string | null } | null },
) {
  const line = classifyDeduction({
    id: savedId,
    date: toDateInputValue(data.date),
    description: data.description,
    amount: Number(data.baseAmount),
    account: "",
    accountType: saved.accountType,
    memberId: space.userId,
    category: saved.category?.name ?? null,
    parent: saved.category?.parent ?? null,
    override: null,
  });
  if (!line.type || line.status !== "ok") return null;
  const rule = RULES[line.type];
  if (!rule.franchigia && !rule.cap) return null;

  const year = data.date.getUTCFullYear();
  const [others, user] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        householdId: space.id,
        userId: space.userId,
        type: "EXPENSE",
        id: { not: savedId },
        date: { gte: utcDate(year, 0, 1), lt: utcDate(year + 1, 0, 1) },
      },
      select: {
        id: true,
        date: true,
        description: true,
        baseAmount: true,
        deduction: true,
        account: { select: { name: true, type: true } },
        category: { select: { name: true, parent: { select: { name: true } } } },
      },
    }),
    prisma.user.findUnique({ where: { id: space.userId }, select: { dependentChildren: true } }),
  ]);
  const before = others
    .map((tx) =>
      classifyDeduction({
        id: tx.id,
        date: toDateInputValue(tx.date),
        description: tx.description,
        amount: Number(tx.baseAmount),
        account: tx.account.name,
        accountType: tx.account.type,
        memberId: space.userId,
        category: tx.category?.name ?? null,
        parent: tx.category?.parent?.name ?? null,
        override: tx.deduction,
      }),
    )
    .filter((l) => l.type === line.type && l.status === "ok")
    .reduce((sum, l) => sum + l.amount, 0);
  return crossingNote(line.type, before, line.amount, user?.dependentChildren ?? 0);
}
