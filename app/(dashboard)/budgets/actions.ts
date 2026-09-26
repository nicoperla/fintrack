"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { type ActionResult, validationError } from "@/lib/action-result";
import { budgetSchema } from "@/lib/validations/planning";

const NOT_FOUND: ActionResult = { ok: false, error: "Budget non trovato." };

export async function saveBudget(id: string | null, input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const category = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, householdId: space.id },
    select: { type: true },
  });
  if (!category || category.type !== "EXPENSE") {
    return { ok: false, fieldErrors: { categoryId: ["Scegli una categoria di uscita"] } };
  }

  try {
    if (id) {
      const { count } = await prisma.budget.updateMany({
        where: { id, householdId: space.id },
        data: parsed.data,
      });
      if (count === 0) return NOT_FOUND;
    } else {
      await prisma.budget.create({
        data: { ...parsed.data, householdId: space.id, userId: space.user.id },
      });
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return {
        ok: false,
        fieldErrors: { categoryId: ["Esiste già un budget per questa categoria"] },
      };
    }
    throw err;
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteBudget(id: string): Promise<ActionResult> {
  const space = await requireSpace();
  const { count } = await prisma.budget.deleteMany({ where: { id, householdId: space.id } });
  if (count === 0) return NOT_FOUND;
  revalidatePath("/", "layout");
  return { ok: true };
}
