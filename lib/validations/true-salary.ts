import { z } from "zod";
import { BIG_EXPENSE_PRESETS } from "@/lib/finance/true-salary";
import { parseAmount } from "@/lib/finance/money";

/*
 * "Lo stipendio vero" forms: the big expenses and the settings. Amounts become canonical
 * "1234.56" strings, like the rest of the app.
 */

const PRESET_KEYS = BIG_EXPENSE_PRESETS.map((p) => p.key) as [string, ...string[]];

const day = (message: string) =>
  z.coerce.number(message).int(message).min(1, message).max(31, message);

export const bigExpenseSchema = z.object({
  preset: z
    .string()
    .nullish()
    .transform((v) => v || null)
    .pipe(z.enum(PRESET_KEYS, "Voce non valida").nullable()),
  name: z.string().trim().min(1, "Scrivi di cosa si tratta").max(60, "Massimo 60 caratteri"),
  amount: z.string().transform((v, ctx) => {
    const parsed = parseAmount(v);
    if (parsed === null || Number(parsed) <= 0) {
      ctx.addIssue({ code: "custom", message: "Scrivi quanto costa in un anno (es. 412)" });
      return z.NEVER;
    }
    return parsed;
  }),
  months: z
    .array(z.coerce.number().int().min(1).max(12), "Scegli almeno un mese")
    .min(1, "Scegli almeno un mese")
    .transform((months) => Array.from(new Set(months)).sort((a, b) => a - b)),
  day: day("Scrivi un giorno da 1 a 31"),
});

export type BigExpenseFormInput = z.output<typeof bigExpenseSchema>;

/** An extra salary: empty or zero means it isn't counted. */
const extraSalary = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v?.trim()) return null;
    const parsed = parseAmount(v);
    if (parsed === null || Number(parsed) < 0) {
      ctx.addIssue({ code: "custom", message: "Importo non valido (es. 1.650)" });
      return z.NEVER;
    }
    return Number(parsed) === 0 ? null : parsed;
  });

export const trueSalarySettingsSchema = z.object({
  payday: z
    .string()
    .optional()
    .transform((v, ctx) => {
      const text = v?.trim();
      if (!text) return null;
      const n = Number(text);
      if (!Number.isInteger(n) || n < 1 || n > 31) {
        ctx.addIssue({ code: "custom", message: "Scrivi un giorno da 1 a 31" });
        return z.NEVER;
      }
      return n;
    }),
  thirteenth: extraSalary,
  fourteenth: extraSalary,
  reserveAccountId: z
    .string()
    .max(40)
    .optional()
    .transform((v) => v || null),
});

export type TrueSalarySettingsInput = z.output<typeof trueSalarySettingsSchema>;
