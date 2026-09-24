"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { type ActionResult, validationError } from "@/lib/action-result";
import { parseAmount } from "@/lib/finance/money";

const amount = (message: string) =>
  z.string().transform((v, ctx) => {
    const parsed = parseAmount(v);
    if (parsed === null || Number(parsed) <= 0) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return parsed;
  });

const debtSchema = z.object({
  name: z.string().trim().min(1, "Dai un nome al debito").max(60, "Massimo 60 caratteri"),
  balance: amount("Inserisci il debito residuo (es. 6.200)"),
  minimumPayment: amount("Inserisci la rata mensile minima (es. 190)"),
  interestRate: z.string().transform((v, ctx) => {
    const parsed = parseAmount(v || "0");
    if (parsed === null || Number(parsed) > 100) {
      ctx.addIssue({ code: "custom", message: "Tasso non valido (es. 6,9)" });
      return z.NEVER;
    }
    return parsed;
  }),
});

const NOT_FOUND: ActionResult = { ok: false, error: "Debito non trovato." };

export async function saveDebt(id: string | null, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = debtSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  if (id) {
    const { count } = await prisma.debt.updateMany({
      where: { id, userId: user.id },
      data: parsed.data,
    });
    if (count === 0) return NOT_FOUND;
  } else {
    await prisma.debt.create({ data: { ...parsed.data, userId: user.id } });
  }
  revalidatePath("/debts");
  return { ok: true };
}

export async function deleteDebt(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const { count } = await prisma.debt.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) return NOT_FOUND;
  revalidatePath("/debts");
  return { ok: true };
}
