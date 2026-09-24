"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { type ActionResult, validationError } from "@/lib/action-result";
import { contributionSchema, goalSchema } from "@/lib/validations/planning";

const NOT_FOUND: ActionResult = { ok: false, error: "Obiettivo non trovato." };

export async function saveGoal(id: string | null, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  if (id) {
    const { count } = await prisma.goal.updateMany({
      where: { id, userId: user.id },
      data: parsed.data,
    });
    if (count === 0) return NOT_FOUND;
  } else {
    await prisma.goal.create({ data: { ...parsed.data, userId: user.id } });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const { count } = await prisma.goal.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) return NOT_FOUND;
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function contributeToGoal(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = contributionSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const amount = new Prisma.Decimal(parsed.data.amount);
  const withdraw = parsed.data.direction === "withdraw";

  // Single conditional UPDATE: a withdrawal can never take the balance below zero, even concurrently.
  const { count } = await prisma.goal.updateMany({
    where: { id, userId: user.id, ...(withdraw ? { currentAmount: { gte: amount } } : {}) },
    data: { currentAmount: withdraw ? { decrement: amount } : { increment: amount } },
  });
  if (count === 0) {
    const exists = await prisma.goal.count({ where: { id, userId: user.id } });
    if (!exists) return NOT_FOUND;
    return {
      ok: false,
      fieldErrors: { amount: ["Non puoi prelevare più di quanto hai accumulato"] },
    };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
