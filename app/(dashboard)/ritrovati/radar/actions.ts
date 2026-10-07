"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { readTaxProfile, type TaxProfile } from "@/lib/finance/rights";
import { todayInAppTimeZone } from "@/lib/dates";
import { rentProfileSchema, welfareSchema } from "@/lib/validations/rights";
import { validationError, type ActionResult } from "@/lib/action-result";

/*
 * "Radar dei diritti": the answers about income, rent and company welfare. They belong to the
 * person, not to the space: each one files their own 730.
 */

async function updateProfile(userId: string, change: (profile: TaxProfile) => TaxProfile) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { taxProfile: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { taxProfile: change(readTaxProfile(user.taxProfile)) },
  });
  revalidatePath("/ritrovati/radar");
  revalidatePath("/ritrovati");
}

export async function saveRentProfile(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = rentProfileSchema(todayInAppTimeZone().year).safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { incomeBand, birthYear, contract, since, transferred } = parsed.data;
  await updateProfile(space.user.id, (profile) => ({
    ...profile,
    incomeBand,
    birthYear,
    rent: { contract, since: contract ? since : null, transferred: contract ? transferred : false },
  }));
  return { ok: true };
}

export async function saveWelfare(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = welfareSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { balance, expiresOn, fringe } = parsed.data;
  await updateProfile(space.user.id, (profile) => ({
    ...profile,
    welfare: {
      balance,
      expiresOn: balance ? expiresOn : null,
      fringe,
      // The fringe benefit limit is yearly: the figure belongs to this year.
      fringeYear: fringe === null ? null : todayInAppTimeZone().year,
    },
  }));
  return { ok: true };
}
