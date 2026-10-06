"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { type ActionResult, validationError } from "@/lib/action-result";
import { valuationSchema } from "@/lib/validations/finance";

/** Records what an investment account is worth on a day (one value per day: a new one replaces it). */
export async function saveValuation(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = valuationSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { accountId, date, value } = parsed.data;

  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, householdId: space.id, type: "INVESTMENT" },
    select: { id: true },
  });
  if (!account) return { ok: false, error: "Conto investimenti non trovato." };

  await prisma.investmentValuation.upsert({
    where: { accountId_date: { accountId, date } },
    create: { householdId: space.id, accountId, date, value },
    update: { value },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteValuation(id: string): Promise<ActionResult> {
  const space = await requireSpace();
  const { count } = await prisma.investmentValuation.deleteMany({
    where: { id, householdId: space.id },
  });
  if (count === 0) return { ok: false, error: "Valore non trovato." };

  revalidatePath("/", "layout");
  return { ok: true };
}
