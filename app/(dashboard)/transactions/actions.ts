"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { type ActionResult, validationError } from "@/lib/action-result";
import { type TransactionInput, transactionSchema } from "@/lib/validations/finance";
import { getBudgetWarnings } from "@/lib/data/budgets";
import { currentMonth } from "@/lib/dates";

const NOT_FOUND: ActionResult = { ok: false, error: "Transazione non trovata." };

async function checkOwnership(
  userId: string,
  data: TransactionInput,
): Promise<ActionResult | null> {
  const accountIds = [data.accountId, data.transferAccountId].filter((v): v is string => !!v);
  const owned = await prisma.financialAccount.count({ where: { userId, id: { in: accountIds } } });
  if (owned !== accountIds.length) {
    return { ok: false, fieldErrors: { accountId: ["Conto non valido"] } };
  }

  if (data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, userId },
      select: { type: true },
    });
    if (!category) return { ok: false, fieldErrors: { categoryId: ["Categoria non valida"] } };
    if (category.type !== data.type) {
      return {
        ok: false,
        fieldErrors: {
          categoryId: [
            data.type === "INCOME"
              ? "Scegli una categoria di entrata"
              : "Scegli una categoria di uscita",
          ],
        },
      };
    }
  }
  return null;
}

export async function saveTransaction(id: string | null, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const ownershipError = await checkOwnership(user.id, parsed.data);
  if (ownershipError) return ownershipError;

  if (id) {
    const { count } = await prisma.transaction.updateMany({
      where: { id, userId: user.id },
      data: parsed.data,
    });
    if (count === 0) return NOT_FOUND;
  } else {
    await prisma.transaction.create({ data: { ...parsed.data, userId: user.id } });
  }

  revalidatePath("/", "layout");

  const { start, end } = currentMonth();
  const affectsCurrentBudgets =
    parsed.data.type === "EXPENSE" &&
    parsed.data.categoryId &&
    parsed.data.date >= start &&
    parsed.data.date < end;
  const warnings = affectsCurrentBudgets
    ? await getBudgetWarnings(user.id, parsed.data.categoryId!)
    : [];
  return { ok: true, warnings };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const { count } = await prisma.transaction.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) return NOT_FOUND;

  revalidatePath("/", "layout");
  return { ok: true };
}
