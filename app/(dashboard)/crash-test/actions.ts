"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { todayInAppTimeZone } from "@/lib/dates";
import { readTaxProfile } from "@/lib/finance/rights";
import { EMERGENCY_GOAL } from "@/lib/finance/crash-test";
import { crashProfileSchema } from "@/lib/validations/crash-test";
import { validationError, type ActionResult } from "@/lib/action-result";

/*
 * "Il crash test": the job is saved per person (the NASpI is everyone's own); the emergency fund
 * is a goal of the space, like the others.
 */

export async function saveCrashProfile(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = crashProfileSchema(todayInAppTimeZone()).safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { work, ral, since, birthYear } = parsed.data;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: space.user.id },
    select: { taxProfile: true },
  });
  // The birth year is the same one the "Radar dei diritti" asks for: one place for both.
  const taxProfile = readTaxProfile(user.taxProfile);
  await prisma.user.update({
    where: { id: space.user.id },
    data: {
      crashProfile: { work, ral, since },
      taxProfile: { ...taxProfile, birthYear: birthYear ?? taxProfile.birthYear },
    },
  });
  revalidatePath("/crash-test");
  return { ok: true };
}

/** The goal the crash test always ends with: months of spending put aside. */
export async function createEmergencyFund(target: number): Promise<ActionResult> {
  const space = await requireSpace();
  if (!Number.isFinite(target) || target <= 0 || target > 1_000_000) {
    return { ok: false, error: "Importo non valido." };
  }
  const goals = await prisma.goal.findMany({
    where: { householdId: space.id },
    select: { name: true },
  });
  if (goals.some((g) => EMERGENCY_GOAL.pattern.test(g.name))) {
    return {
      ok: false,
      error: "C'è già un obiettivo per gli imprevisti: lo trovi in Obiettivi.",
    };
  }
  await prisma.goal.create({
    data: {
      householdId: space.id,
      userId: space.user.id,
      name: EMERGENCY_GOAL.name,
      targetAmount: Math.ceil(target),
      icon: EMERGENCY_GOAL.icon,
      color: EMERGENCY_GOAL.color,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
