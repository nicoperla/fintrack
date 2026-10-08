"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { fundCostsSchema } from "@/lib/validations/fund-costs";
import { validationError, type ActionResult } from "@/lib/action-result";

/* "Radiografia dei costi": one row per investment account of the space. */

const NOT_FOUND: ActionResult = { ok: false, error: "Conto investimenti non trovato." };

function refresh() {
  revalidatePath("/investments/costi");
  revalidatePath("/investments");
}

export async function saveFundCosts(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = fundCostsSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { accountId, category, entry, exit, ongoing, transaction, performance, monthly } =
    parsed.data;
  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, householdId: space.id, type: "INVESTMENT" },
    select: { id: true },
  });
  if (!account) return NOT_FOUND;

  const data = {
    category,
    entryPct: entry,
    exitPct: exit,
    ongoingPct: ongoing,
    transactionPct: transaction,
    performancePct: performance,
    monthly,
  };
  await prisma.investmentCost.upsert({
    where: { accountId },
    create: { accountId, householdId: space.id, ...data },
    update: data,
  });
  refresh();
  return { ok: true };
}

export async function deleteFundCosts(accountId: string): Promise<ActionResult> {
  const space = await requireSpace();
  const { count } = await prisma.investmentCost.deleteMany({
    where: { accountId, householdId: space.id },
  });
  if (count === 0) return NOT_FOUND;
  refresh();
  return { ok: true };
}
