"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { type ActionResult, validationError } from "@/lib/action-result";
import { accountSchema } from "@/lib/validations/finance";

const NOT_FOUND: ActionResult = { ok: false, error: "Conto non trovato." };

export async function saveAccount(id: string | null, input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const data = { ...parsed.data, currency: parsed.data.currency ?? space.currency };

  if (id) {
    const existing = await prisma.financialAccount.findFirst({
      where: { id, householdId: space.id },
      select: {
        currency: true,
        _count: { select: { transactions: true, incomingTransfers: true } },
      },
    });
    if (!existing) return NOT_FOUND;
    const used = existing._count.transactions + existing._count.incomingTransfers > 0;
    // Stored amounts are in the account's currency: changing it would silently change their value.
    if (used && data.currency !== existing.currency) {
      return {
        ok: false,
        fieldErrors: {
          currency: ["La valuta non si può cambiare dopo aver registrato dei movimenti."],
        },
      };
    }
    await prisma.financialAccount.update({ where: { id }, data });
  } else {
    await prisma.financialAccount.create({
      data: { ...data, householdId: space.id, userId: space.user.id },
    });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const space = await requireSpace();
  // Cascades to the account's transactions, including transfers to/from it.
  const { count } = await prisma.financialAccount.deleteMany({
    where: { id, householdId: space.id },
  });
  if (count === 0) return NOT_FOUND;

  revalidatePath("/", "layout");
  return { ok: true };
}
