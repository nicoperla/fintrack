"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/action-result";
import { saveTransactionInSpace } from "@/lib/transactions/save";

/**
 * `deferRevalidate` lets the onboarding keep its final step on screen: revalidating here would
 * re-render the dashboard (now with an account) mid-flow. It then revalidates when it's done.
 */
export async function saveTransaction(
  id: string | null,
  input: unknown,
  options?: { deferRevalidate?: boolean },
): Promise<ActionResult> {
  const space = await requireSpace();
  const result = await saveTransactionInSpace(
    { id: space.id, currency: space.currency, userId: space.user.id },
    id,
    input,
  );
  if (result.ok && !options?.deferRevalidate) revalidatePath("/", "layout");
  return result;
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const space = await requireSpace();
  const { count } = await prisma.transaction.deleteMany({
    where: { id, householdId: space.id },
  });
  if (count === 0) return { ok: false, error: "Transazione non trovata." };

  revalidatePath("/", "layout");
  return { ok: true };
}
