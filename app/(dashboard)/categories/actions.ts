"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { type ActionResult, validationError } from "@/lib/action-result";
import { categorySchema } from "@/lib/validations/finance";

const NOT_FOUND: ActionResult = { ok: false, error: "Categoria non trovata." };

export async function saveCategory(id: string | null, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data;

  if (data.parentId) {
    const parent = await prisma.category.findFirst({
      where: { id: data.parentId, userId: user.id },
      select: { id: true, parentId: true, type: true },
    });
    if (!parent || parent.id === id) {
      return { ok: false, fieldErrors: { parentId: ["Categoria principale non valida"] } };
    }
    if (parent.parentId) {
      return {
        ok: false,
        fieldErrors: {
          parentId: ["Le sottocategorie non possono avere a loro volta sottocategorie"],
        },
      };
    }
    if (parent.type !== data.type) {
      return {
        ok: false,
        fieldErrors: { parentId: ["La categoria principale deve essere dello stesso tipo"] },
      };
    }
  }

  if (!id) {
    await prisma.category.create({ data: { ...data, userId: user.id } });
    revalidatePath("/", "layout");
    return { ok: true };
  }

  const existing = await prisma.category.findFirst({
    where: { id, userId: user.id },
    select: { type: true, _count: { select: { children: true, transactions: true } } },
  });
  if (!existing) return NOT_FOUND;

  if (data.parentId && existing._count.children > 0) {
    return {
      ok: false,
      fieldErrors: {
        parentId: [
          "Questa categoria ha delle sottocategorie: non può diventare una sottocategoria",
        ],
      },
    };
  }
  if (
    data.type !== existing.type &&
    (existing._count.transactions > 0 || existing._count.children > 0)
  ) {
    return {
      ok: false,
      fieldErrors: {
        type: ["Non puoi cambiare il tipo di una categoria che ha transazioni o sottocategorie"],
      },
    };
  }

  await prisma.category.update({ where: { id }, data });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const user = await requireUser();
  // Subcategories are deleted too; their transactions stay, uncategorized.
  const { count } = await prisma.category.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) return NOT_FOUND;

  revalidatePath("/", "layout");
  return { ok: true };
}
