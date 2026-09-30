"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
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
