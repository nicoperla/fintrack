"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { type ActionResult, validationError } from "@/lib/action-result";
import { accountSchema } from "@/lib/validations/finance";

const NOT_FOUND: ActionResult = { ok: false, error: "Conto non trovato." };

export async function saveAccount(id: string | null, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  if (id) {
    const { count } = await prisma.financialAccount.updateMany({
      where: { id, userId: user.id },
      data: parsed.data,
    });
    if (count === 0) return NOT_FOUND;
  } else {
    await prisma.financialAccount.create({ data: { ...parsed.data, userId: user.id } });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const user = await requireUser();
  // Cascades to the account's transactions, including transfers to/from it.
  const { count } = await prisma.financialAccount.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) return NOT_FOUND;

  revalidatePath("/", "layout");
  return { ok: true };
}
