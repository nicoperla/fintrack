"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";
import {
  bankAccountSchema,
  carInsuranceSchema,
  electricitySchema,
  tariffProfileSchema,
} from "@/lib/validations/tariffs";
import { validationError, type ActionResult } from "@/lib/action-result";

/*
 * "Il Tariffometro": the space's province, its RC auto policies, accounts and light bills. Every
 * write is scoped to the active space, like the rest of the app.
 */

const NOT_FOUND: ActionResult = { ok: false, error: "Non trovato: forse è già stato eliminato." };
const asDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`) : null);

function refresh() {
  revalidatePath("/ritrovati/tariffometro");
  revalidatePath("/ritrovati");
}

export async function saveTariffProfile(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = tariffProfileSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  await prisma.household.update({ where: { id: space.id }, data: parsed.data });
  refresh();
  return { ok: true };
}

export async function saveCarInsurance(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = carInsuranceSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { id, label, premium, renewsOn, bonusMalus, ageBand } = parsed.data;
  const data = { label, amount: premium, renewsOn: asDate(renewsOn), bonusMalus, ageBand };

  if (!id) {
    await prisma.tariffCheck.create({
      data: { householdId: space.id, kind: "CAR_INSURANCE", ...data },
    });
  } else {
    const existing = await prisma.tariffCheck.findFirst({
      where: { id, householdId: space.id, kind: "CAR_INSURANCE" },
      select: { amount: true, previousAmount: true, renewsOn: true },
    });
    if (!existing) return NOT_FOUND;
    // A later end date with a different premium is the next policy year: keep the old premium
    // to show what changing (or not) cost.
    const renewed =
      existing.renewsOn !== null &&
      data.renewsOn !== null &&
      data.renewsOn > existing.renewsOn &&
      Number(existing.amount) !== premium;
    await prisma.tariffCheck.updateMany({
      where: { id, householdId: space.id },
      data: { ...data, previousAmount: renewed ? existing.amount : existing.previousAmount },
    });
  }
  refresh();
  return { ok: true };
}

export async function saveBankAccount(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = bankAccountSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { accountId, accountKind, yearly } = parsed.data;
  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, householdId: space.id },
    select: { name: true },
  });
  if (!account) return NOT_FOUND;
  const data = { label: account.name, accountKind, amount: yearly };
  await prisma.tariffCheck.upsert({
    where: { householdId_accountId: { householdId: space.id, accountId } },
    create: { householdId: space.id, kind: "BANK_ACCOUNT", accountId, ...data },
    update: data,
  });
  refresh();
  return { ok: true };
}

export async function saveElectricityBill(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const t = todayInAppTimeZone();
  const parsed = electricitySchema(toDateInputValue(utcDate(t.year, t.month, t.day))).safeParse(
    input,
  );
  if (!parsed.success) return validationError(parsed.error);
  const { id, label, amount, kwh, periodFrom, periodTo, renewsOn } = parsed.data;
  const data = {
    label,
    amount,
    kwh,
    periodFrom: asDate(periodFrom),
    periodTo: asDate(periodTo),
    renewsOn: asDate(renewsOn),
  };
  if (!id) {
    await prisma.tariffCheck.create({
      data: { householdId: space.id, kind: "ELECTRICITY", ...data },
    });
  } else {
    const { count } = await prisma.tariffCheck.updateMany({
      where: { id, householdId: space.id, kind: "ELECTRICITY" },
      data,
    });
    if (count === 0) return NOT_FOUND;
  }
  refresh();
  return { ok: true };
}

export async function deleteTariffCheck(id: string): Promise<ActionResult> {
  const space = await requireSpace();
  const { count } = await prisma.tariffCheck.deleteMany({
    where: { id: String(id), householdId: space.id },
  });
  if (count === 0) return NOT_FOUND;
  refresh();
  return { ok: true };
}

/** The consent to add the space's figures, anonymously, to the comparison between users. */
export async function setTariffPool(join: boolean): Promise<ActionResult> {
  const space = await requireSpace();
  await prisma.household.update({
    where: { id: space.id },
    data: { tariffPoolSince: join === true ? new Date() : null },
  });
  refresh();
  return { ok: true };
}
