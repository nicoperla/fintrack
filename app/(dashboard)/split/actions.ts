"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { type ActionResult, validationError } from "@/lib/action-result";
import { PERSONAL_TAG } from "@/lib/data/split";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";

const settingsSchema = z.object({
  mode: z.enum(["EQUAL", "INCOME"]),
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida"),
});

export async function updateSplitSettings(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const since = new Date(`${parsed.data.since}T00:00:00Z`);
  if (Number.isNaN(since.getTime()))
    return { ok: false, fieldErrors: { since: ["Data non valida"] } };

  await prisma.household.update({
    where: { id: space.id },
    data: { splitMode: parsed.data.mode, splitSince: since },
  });
  revalidatePath("/split");
  return { ok: true };
}

const settlementSchema = z.object({
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  amount: z.number().positive().max(1_000_000),
});

export async function recordSettlement(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = settlementSchema.safeParse(input);
  if (!parsed.success || parsed.data.fromUserId === parsed.data.toUserId) {
    return { ok: false, error: "Pareggio non valido." };
  }
  const members = await prisma.householdMember.count({
    where: {
      householdId: space.id,
      userId: { in: [parsed.data.fromUserId, parsed.data.toUserId] },
    },
  });
  if (members !== 2)
    return { ok: false, error: "Entrambe le persone devono far parte dello spazio." };

  const t = todayInAppTimeZone();
  await prisma.settlement.create({
    data: {
      householdId: space.id,
      fromUserId: parsed.data.fromUserId,
      toUserId: parsed.data.toUserId,
      amount: Math.round(parsed.data.amount * 100) / 100,
      date: utcDate(t.year, t.month, t.day),
    },
  });
  revalidatePath("/split");
  return { ok: true };
}

export async function deleteSettlement(id: string): Promise<ActionResult> {
  const space = await requireSpace();
  const { count } = await prisma.settlement.deleteMany({ where: { id, householdId: space.id } });
  if (count === 0) return { ok: false, error: "Pareggio non trovato." };
  revalidatePath("/split");
  return { ok: true };
}

/** Marks an expense as personal (out of the shared accounts) or shared again, via its tags. */
export async function setExpensePersonal(id: string, personal: boolean): Promise<ActionResult> {
  const space = await requireSpace();
  const tx = await prisma.transaction.findFirst({
    where: { id, householdId: space.id, type: "EXPENSE" },
    select: { tags: true },
  });
  if (!tx) return { ok: false, error: "Movimento non trovato." };

  const others = tx.tags.filter((tag) => tag !== PERSONAL_TAG);
  await prisma.transaction.update({
    where: { id },
    data: { tags: personal ? [...others, PERSONAL_TAG] : others },
  });
  revalidatePath("/split");
  revalidatePath("/transactions");
  return { ok: true };
}
