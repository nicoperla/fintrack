"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import {
  IGNORED_RECURRING_PREFIX,
  RESERVE_ACCOUNT_TYPES,
  nextPayment,
} from "@/lib/finance/true-salary";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";
import { bigExpenseSchema, trueSalarySettingsSchema } from "@/lib/validations/true-salary";
import { validationError, type ActionResult } from "@/lib/action-result";

/*
 * "Lo stipendio vero": the year's big expenses and the settings of the number. Every query is
 * scoped to the active space.
 */

const NOT_FOUND: ActionResult = { ok: false, error: "Voce non trovata." };
const idSchema = z.string().min(1).max(40);
const recurringKeySchema = z.string().min(3).max(300);

function today() {
  const t = todayInAppTimeZone();
  return toDateInputValue(utcDate(t.year, t.month, t.day));
}

function revalidate() {
  revalidatePath("/stipendio-vero");
  revalidatePath("/dashboard");
}

/** Adds a big expense (id null) or changes one. */
export async function saveBigExpense(id: unknown, input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = bigExpenseSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data;

  if (id === null) {
    await prisma.bigExpense.create({ data: { householdId: space.id, ...data } });
  } else {
    const bigExpenseId = idSchema.safeParse(id);
    if (!bigExpenseId.success) return NOT_FOUND;
    const { count } = await prisma.bigExpense.updateMany({
      where: { id: bigExpenseId.data, householdId: space.id },
      // New dates or amounts: what was marked as paid may not match them anymore.
      data: { ...data, paidThrough: null },
    });
    if (count === 0) return NOT_FOUND;
  }
  revalidate();
  return { ok: true };
}

export async function deleteBigExpense(id: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const bigExpenseId = idSchema.safeParse(id);
  if (!bigExpenseId.success) return NOT_FOUND;
  const { count } = await prisma.bigExpense.deleteMany({
    where: { id: bigExpenseId.data, householdId: space.id },
  });
  if (count === 0) return NOT_FOUND;
  revalidate();
  return { ok: true };
}

/** Paid before the due date: its money stops being set aside. */
export async function markBigExpensePaid(id: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const bigExpenseId = idSchema.safeParse(id);
  if (!bigExpenseId.success) return NOT_FOUND;
  const row = await prisma.bigExpense.findFirst({
    where: { id: bigExpenseId.data, householdId: space.id },
  });
  if (!row) return NOT_FOUND;
  const next = nextPayment(
    {
      amount: Number(row.amount),
      months: row.months,
      day: row.day,
      paidThrough: row.paidThrough ? toDateInputValue(row.paidThrough) : null,
    },
    today(),
  );
  if (!next) return NOT_FOUND;
  await prisma.bigExpense.updateMany({
    where: { id: row.id, householdId: space.id },
    data: { paidThrough: new Date(`${next.date}T00:00:00.000Z`) },
  });
  revalidate();
  return { ok: true };
}

/** "Not paid yet": the payment marked by mistake is set aside again. */
export async function undoBigExpensePaid(id: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const bigExpenseId = idSchema.safeParse(id);
  if (!bigExpenseId.success) return NOT_FOUND;
  const { count } = await prisma.bigExpense.updateMany({
    where: { id: bigExpenseId.data, householdId: space.id },
    data: { paidThrough: null },
  });
  if (count === 0) return NOT_FOUND;
  revalidate();
  return { ok: true };
}

export async function saveTrueSalarySettings(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = trueSalarySettingsSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data;

  if (data.reserveAccountId) {
    const account = await prisma.financialAccount.findFirst({
      where: { id: data.reserveAccountId, householdId: space.id },
      select: { type: true },
    });
    if (!account || !RESERVE_ACCOUNT_TYPES.includes(account.type)) {
      return { ok: false, fieldErrors: { reserveAccountId: ["Scegli uno dei tuoi conti"] } };
    }
  }
  await prisma.household.update({
    where: { id: space.id },
    data: {
      payday: data.payday,
      thirteenthSalary: data.thirteenth,
      fourteenthSalary: data.fourteenth,
      reserveAccountId: data.reserveAccountId,
    },
  });
  revalidate();
  return { ok: true };
}

/** Shows the true salary on the dashboard instead of the plain balance, or stops. */
export async function setTrueSalaryActive(on: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = z.boolean().safeParse(on);
  if (!parsed.success) return { ok: false, error: "Scelta non valida." };
  await prisma.household.update({
    where: { id: space.id },
    data: { trueSalarySince: parsed.data ? new Date() : null },
  });
  revalidate();
  return { ok: true };
}

/** A quarterly or yearly charge found among the movements: count it, or not. */
export async function setRecurringCounted(key: unknown, counted: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsedKey = recurringKeySchema.safeParse(key);
  const parsedCounted = z.boolean().safeParse(counted);
  if (!parsedKey.success || !parsedCounted.success) return NOT_FOUND;
  const dismissal = `${IGNORED_RECURRING_PREFIX}${parsedKey.data}`;
  if (parsedCounted.data) {
    await prisma.foundMoneyDismissal.deleteMany({
      where: { householdId: space.id, key: dismissal },
    });
  } else {
    await prisma.foundMoneyDismissal.upsert({
      where: { householdId_key: { householdId: space.id, key: dismissal } },
      create: { householdId: space.id, key: dismissal },
      update: {},
    });
  }
  revalidate();
  return { ok: true };
}
