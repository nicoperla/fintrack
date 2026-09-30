"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { type ActionResult, validationError } from "@/lib/action-result";
import { categorySchema } from "@/lib/validations/finance";
import { suggestMissingCategories } from "@/lib/defaults/suggestions";

const NOT_FOUND: ActionResult = { ok: false, error: "Categoria non trovata." };

export async function saveCategory(id: string | null, input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data;

  if (data.parentId) {
    const parent = await prisma.category.findFirst({
      where: { id: data.parentId, householdId: space.id },
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
    await prisma.category.create({
      data: { ...data, householdId: space.id, userId: space.user.id },
    });
    revalidatePath("/", "layout");
    return { ok: true };
  }

  const existing = await prisma.category.findFirst({
    where: { id, householdId: space.id },
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
  const space = await requireSpace();
  // Subcategories are deleted too; their transactions stay, uncategorized.
  const { count } = await prisma.category.deleteMany({ where: { id, householdId: space.id } });
  if (count === 0) return NOT_FOUND;

  revalidatePath("/", "layout");
  return { ok: true };
}

const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("it") === b.trim().toLocaleLowerCase("it");

/**
 * Adds the chosen starter categories the space doesn't have yet: the whole group when the
 * top-level category is missing, otherwise only its missing subcategories.
 */
export async function addSuggestedCategories(names: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = z.array(z.string().max(60)).max(50).safeParse(names);
  if (!parsed.success) return validationError(parsed.error);

  const existing = await prisma.category.findMany({
    where: { householdId: space.id },
    select: {
      id: true,
      name: true,
      type: true,
      parentId: true,
      parent: { select: { name: true } },
    },
  });
  const chosen = suggestMissingCategories(
    existing.map((c) => ({ name: c.name, type: c.type, parentName: c.parent?.name ?? null })),
  ).filter((s) => parsed.data.includes(s.category.name));
  if (chosen.length === 0) return { ok: true };

  const owner = { householdId: space.id, userId: space.user.id };
  await prisma.$transaction(async (tx) => {
    for (const { category, missingParent, missingChildren } of chosen) {
      const parentId = missingParent
        ? (
            await tx.category.create({
              data: {
                ...owner,
                name: category.name,
                type: category.type,
                icon: category.icon,
                color: category.color,
              },
            })
          ).id
        : existing.find(
            (c) =>
              c.parentId === null && c.type === category.type && sameName(c.name, category.name),
          )!.id;
      if (missingChildren.length) {
        await tx.category.createMany({
          data: missingChildren.map((child) => ({
            ...owner,
            name: child.name,
            type: category.type,
            icon: child.icon,
            color: category.color,
            parentId,
          })),
        });
      }
    }
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
