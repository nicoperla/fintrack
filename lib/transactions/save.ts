import { prisma } from "@/lib/db/prisma";
import { type ActionResult, validationError } from "@/lib/action-result";
import { type TransactionInput, transactionSchema } from "@/lib/validations/finance";
import { getBudgetWarnings } from "@/lib/data/budgets";
import { currentMonth } from "@/lib/dates";
import { CurrencyError } from "@/lib/currency/convert";
import { createConverter } from "@/lib/currency/rates";
import { inferDeduction, refundOf, RULES } from "@/lib/finance/deductions";
import { formatCurrency } from "@/lib/format";

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
): Promise<ActionResult> {
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

  if (id) {
    const { count } = await prisma.transaction.updateMany({
      where: { id, householdId: space.id },
      data,
    });
    if (count === 0) return NOT_FOUND;
  } else {
    await prisma.transaction.create({
      data: { ...data, householdId: space.id, userId: space.userId },
    });
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
  return { ok: true, warnings };
}
