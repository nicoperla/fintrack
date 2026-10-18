"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { saveTransactionInSpace } from "@/lib/transactions/save";
import { validationError, type ActionResult } from "@/lib/action-result";

/*
 * "Foto dello scontrino": the receipt the user checked becomes one or two movements, the health
 * part (medicines, devices, tickets) and the rest. Only totals are saved: never the item names.
 */

const part = z.object({
  amount: z.string().trim().min(1).max(20),
  categoryId: z.string().trim().max(40).nullable(),
});

const receiptSaveSchema = z.object({
  accountId: z.string().trim().min(1, "Scegli un conto").max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida"),
  merchant: z.string().trim().max(60).default(""),
  /** The receipt has the buyer's codice fiscale: without it medicines aren't deductible. */
  fiscalCode: z.boolean(),
  /** The user keeps the paper receipt: the 730 folder ticks it. */
  keepReceipt: z.boolean().default(true),
  health: part.nullable(),
  other: part.nullable(),
});

export async function saveReceipt(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = receiptSaveSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { accountId, date, merchant, fiscalCode, keepReceipt, health, other } = parsed.data;
  if (!health && !other) return { ok: false, error: "Niente da salvare." };

  const ref = { id: space.id, currency: space.currency, userId: space.user.id };
  const name = merchant || "Scontrino";
  const warnings: string[] = [];
  const save = (p: z.infer<typeof part>, description: string) =>
    saveTransactionInSpace(ref, null, {
      type: "EXPENSE",
      amount: p.amount,
      date,
      description,
      accountId,
      categoryId: p.categoryId ?? undefined,
      tags: "scontrino",
    });

  if (health) {
    const res = await save(health, `${name} · farmaci`);
    if (!res.ok) return res;
    warnings.push(...(res.warnings ?? []));
    if (res.id) {
      await prisma.transaction.updateMany({
        where: { id: res.id, householdId: space.id },
        // Without the codice fiscale on the receipt, the 730 doesn't take it: say so on the movement.
        data: fiscalCode
          ? { deductionDoc: keepReceipt ? "have" : null }
          : { deduction: "none", notes: "Scontrino senza codice fiscale: non detraibile." },
      });
    }
  }
  if (other) {
    const res = await save(other, health ? `${name} · altro` : name);
    if (!res.ok) return res;
    warnings.push(...(res.warnings ?? []));
    // The user said these don't count: a pharmacy's name in the description mustn't make them.
    if (res.id) {
      await prisma.transaction.updateMany({
        where: { id: res.id, householdId: space.id },
        data: { deduction: "none" },
      });
    }
  }

  revalidatePath("/", "layout");
  return { ok: true, warnings };
}
