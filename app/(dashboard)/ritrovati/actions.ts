"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { hasPro } from "@/lib/billing/plan";
import { DEDUCTION_TYPES } from "@/lib/finance/deductions";
import type { ActionResult } from "@/lib/action-result";

const PRO_ONLY: ActionResult = {
  ok: false,
  error: "I dettagli di Soldi ritrovati fanno parte di FinTrack Pro.",
};

async function requirePro() {
  const space = await requireSpace();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: space.user.id },
    select: { plan: true },
  });
  return { space, pro: hasPro(user) };
}

function revalidate() {
  revalidatePath("/ritrovati");
  revalidatePath("/dashboard");
}

const deductionSchema = z.union([
  z.enum(DEDUCTION_TYPES as [string, ...string[]]),
  z.literal("none"),
  z.null(),
]);

/** The user's call on an expense: deductible as a given type, not deductible, or automatic. */
export async function setDeduction(transactionId: string, value: unknown): Promise<ActionResult> {
  const { space, pro } = await requirePro();
  if (!pro) return PRO_ONLY;
  const parsed = deductionSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: "Scelta non valida." };

  const { count } = await prisma.transaction.updateMany({
    where: { id: transactionId, householdId: space.id, type: "EXPENSE" },
    data: { deduction: parsed.data },
  });
  if (count === 0) return { ok: false, error: "Movimento non trovato." };
  revalidate();
  return { ok: true };
}

const keySchema = z.string().min(3).max(300);

/** "It's fine": a duplicate that wasn't one, an increase or renewal the user keeps. */
export async function dismissFinding(key: unknown): Promise<ActionResult> {
  const { space, pro } = await requirePro();
  if (!pro) return PRO_ONLY;
  const parsed = keySchema.safeParse(key);
  if (!parsed.success) return { ok: false, error: "Segnalazione non valida." };
  await prisma.foundMoneyDismissal.upsert({
    where: { householdId_key: { householdId: space.id, key: parsed.data } },
    create: { householdId: space.id, key: parsed.data },
    update: {},
  });
  revalidate();
  return { ok: true };
}

export async function setDependentChildren(value: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = z.coerce.number().int().min(0).max(10).safeParse(value);
  if (!parsed.success) return { ok: false, error: "Numero non valido." };
  await prisma.user.update({
    where: { id: space.user.id },
    data: { dependentChildren: parsed.data },
  });
  revalidate();
  return { ok: true };
}
