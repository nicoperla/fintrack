import { z } from "zod";
import { parseAmount } from "@/lib/finance/money";
import { CATEGORY_ICON_NAMES } from "@/lib/category-style";
import { MAX_IMPORT_ROWS } from "@/lib/import/csv";

const positiveAmount = (message: string) =>
  z.string().transform((v, ctx) => {
    const parsed = parseAmount(v);
    if (parsed === null || Number(parsed) <= 0) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return parsed;
  });

export const budgetSchema = z.object({
  categoryId: z.string().trim().min(1, "Scegli una categoria").max(40),
  amount: positiveAmount("Inserisci un importo maggiore di zero (es. 250)"),
  alertThreshold: z.coerce
    .number("Inserisci una percentuale")
    .int("Usa un numero intero")
    .min(1, "Minimo 1%")
    .max(100, "Massimo 100%"),
});

export const goalSchema = z.object({
  name: z.string().trim().min(1, "Dai un nome all'obiettivo").max(60, "Massimo 60 caratteri"),
  targetAmount: positiveAmount("Inserisci un importo maggiore di zero (es. 3.000)"),
  currentAmount: z.string().transform((v, ctx) => {
    const parsed = parseAmount(v || "0");
    if (parsed === null) {
      ctx.addIssue({ code: "custom", message: "Importo non valido" });
      return z.NEVER;
    }
    return parsed;
  }),
  targetDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null))
    .refine((d) => d === null || !Number.isNaN(d.getTime()), "Data non valida"),
  icon: z.enum(CATEGORY_ICON_NAMES, "Scegli un'icona"),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Colore non valido"),
});

export const contributionSchema = z.object({
  direction: z.enum(["deposit", "withdraw"]),
  amount: positiveAmount("Inserisci un importo maggiore di zero"),
});

export const importRowSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .transform((v) => new Date(`${v}T00:00:00.000Z`))
    .refine((d) => !Number.isNaN(d.getTime())),
  description: z.string().trim().min(1).max(120),
  amount: z
    .string()
    .regex(/^\d{1,12}\.\d{2}$/)
    .refine((v) => Number(v) > 0),
  type: z.enum(["INCOME", "EXPENSE"]),
});

export const importSchema = z.object({
  accountId: z.string().trim().min(1).max(40),
  rows: z.array(importRowSchema).min(1, "Nessuna riga da importare").max(MAX_IMPORT_ROWS),
});
