"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { readTaxProfile } from "@/lib/finance/rights";
import { todayInAppTimeZone } from "@/lib/dates";
import { iseeSchema } from "@/lib/validations/tax";
import { validationError, type ActionResult } from "@/lib/action-result";

/** "ISEE e bonus": the value of the person's ISEE, to tell which bonuses fit (null forgets it). */
export async function saveIsee(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = iseeSchema(todayInAppTimeZone().year).safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: space.user.id },
    select: { taxProfile: true },
  });
  const profile = readTaxProfile(user.taxProfile);
  await prisma.user.update({
    where: { id: space.user.id },
    data: {
      taxProfile: {
        ...profile,
        isee: {
          value: parsed.data.value,
          year: parsed.data.value === null ? null : parsed.data.year,
        },
      },
    },
  });
  revalidatePath("/isee");
  return { ok: true };
}
