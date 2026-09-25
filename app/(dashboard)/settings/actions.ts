"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { type ActionResult, validationError } from "@/lib/action-result";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Inserisci il tuo nome").max(80, "Massimo 80 caratteri"),
});

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setWeeklyDigest(enabled: boolean): Promise<ActionResult> {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { weeklyDigest: enabled === true } });
  revalidatePath("/settings");
  return { ok: true };
}
