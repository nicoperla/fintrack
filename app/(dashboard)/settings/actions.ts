"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { type ActionResult, validationError } from "@/lib/action-result";
import { parseAmount } from "@/lib/finance/money";

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

const workSchema = z.object({
  monthlyNetIncome: z.string().transform((v, ctx) => {
    if (!v.trim()) return null;
    const parsed = parseAmount(v);
    if (parsed === null || Number(parsed) <= 0) {
      ctx.addIssue({ code: "custom", message: "Importo non valido (es. 1850)" });
      return z.NEVER;
    }
    return parsed;
  }),
  workHoursPerWeek: z.coerce
    .number("Inserisci le ore")
    .int("Solo ore intere")
    .min(1, "Almeno 1 ora")
    .max(80, "Al massimo 80 ore"),
  showWorkTime: z.boolean(),
});

export async function updateWorkSettings(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = workSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  await prisma.user.update({ where: { id: user.id }, data: parsed.data });
  revalidatePath("/", "layout");
  return { ok: true };
}
