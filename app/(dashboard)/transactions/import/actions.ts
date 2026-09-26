"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { type ActionResult, validationError } from "@/lib/action-result";
import { importRowSchema, importSchema } from "@/lib/validations/planning";
import { MAX_IMPORT_ROWS } from "@/lib/import/csv";
import { CurrencyError } from "@/lib/currency/convert";
import { createConverter } from "@/lib/currency/rates";

const duplicatesSchema = z.object({
  accountId: z.string().trim().min(1).max(40),
  rows: z.array(importRowSchema).max(MAX_IMPORT_ROWS),
});

const rowKey = (date: Date, amount: string, type: string) =>
  `${date.toISOString().slice(0, 10)}|${amount}|${type}`;

/**
 * Flags rows that probably already exist in the account: same date, amount and type.
 * Descriptions are ignored on purpose — bank wording rarely matches what was typed by hand.
 */
export async function findDuplicates(input: unknown): Promise<boolean[] | null> {
  const space = await requireSpace();
  const parsed = duplicatesSchema.safeParse(input);
  if (!parsed.success || parsed.data.rows.length === 0) return null;
  const { accountId, rows } = parsed.data;

  const dates = rows.map((r) => r.date.getTime());
  const existing = await prisma.transaction.findMany({
    where: {
      householdId: space.id,
      accountId,
      type: { in: ["INCOME", "EXPENSE"] },
      date: { gte: new Date(Math.min(...dates)), lte: new Date(Math.max(...dates)) },
    },
    select: { date: true, amount: true, type: true },
  });

  const available = new Map<string, number>();
  for (const t of existing) {
    const key = rowKey(t.date, t.amount.toFixed(2), t.type);
    available.set(key, (available.get(key) ?? 0) + 1);
  }
  // Each existing transaction can only "absorb" one imported row.
  return rows.map((r) => {
    const key = rowKey(r.date, r.amount, r.type);
    const left = available.get(key) ?? 0;
    if (left === 0) return false;
    available.set(key, left - 1);
    return true;
  });
}

type ImportResult = ActionResult & { imported?: number; categorized?: number };

export async function importTransactions(input: unknown): Promise<ImportResult> {
  const space = await requireSpace();
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { accountId, rows } = parsed.data;

  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, householdId: space.id },
    select: { currency: true },
  });
  if (!account) return { ok: false, error: "Conto non valido." };

  // Amounts are in the account's currency: convert each row at the rate of its own day.
  let baseAmounts: string[];
  try {
    const times = rows.map((r) => r.date.getTime());
    const converter = await createConverter(
      [account.currency, space.currency],
      new Date(Math.min(...times)),
      new Date(Math.max(...times)),
    );
    baseAmounts = rows.map((r) =>
      converter.convert(Number(r.amount), account.currency, space.currency, r.date).toFixed(2),
    );
  } catch (error) {
    if (error instanceof CurrencyError) return { ok: false, error: error.message };
    throw error;
  }

  // Reuse the category of the most recent transaction with the same description and type.
  const descriptions = Array.from(new Set(rows.map((r) => r.description.toLowerCase())));
  const learned = await prisma.$queryRaw<{ key: string; type: string; category_id: string }[]>`
    SELECT DISTINCT ON (lower(t."description"), t."type") lower(t."description") AS key, t."type"::text AS type, t."category_id"
    FROM "transactions" t
    WHERE t."household_id" = ${space.id}
      AND t."category_id" IS NOT NULL
      AND lower(t."description") = ANY(${descriptions})
    ORDER BY lower(t."description"), t."type", t."date" DESC`;
  const categoryFor = new Map(learned.map((l) => [`${l.key}|${l.type}`, l.category_id]));

  let categorized = 0;
  const data = rows.map((r, i) => {
    const categoryId = categoryFor.get(`${r.description.toLowerCase()}|${r.type}`) ?? null;
    if (categoryId) categorized++;
    return {
      ...r,
      baseAmount: baseAmounts[i],
      householdId: space.id,
      userId: space.user.id,
      accountId,
      categoryId,
      tags: ["importato"],
    };
  });

  const { count } = await prisma.transaction.createMany({ data });
  revalidatePath("/", "layout");
  return { ok: true, imported: count, categorized };
}
