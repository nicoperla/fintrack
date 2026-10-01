"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSpace, requireUser } from "@/lib/auth/session";
import { type ActionResult, validationError } from "@/lib/action-result";
import { coachProfileSchema } from "@/lib/finance/coach-profile";

export async function saveCoachProfile(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = coachProfileSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  // Only categories of the active space can be protected.
  const owned = await prisma.category.findMany({
    where: { householdId: space.id, id: { in: parsed.data.protectedCategoryIds } },
    select: { id: true },
  });
  const profile = { ...parsed.data, protectedCategoryIds: owned.map((c) => c.id) };

  await prisma.user.update({ where: { id: space.user.id }, data: { coachProfile: profile } });
  revalidatePath("/coach");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Consent to send a summary of the data to the AI provider when asking the coach. */
export async function setAiConsent(consent: boolean): Promise<ActionResult> {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { aiConsentAt: consent === true ? new Date() : null },
  });
  revalidatePath("/coach");
  revalidatePath("/settings");
  return { ok: true };
}
