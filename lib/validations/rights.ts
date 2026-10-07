import { z } from "zod";
import { INCOME_BANDS, RENT_CONTRACTS } from "@/lib/finance/rights";
import { parseAmount } from "@/lib/finance/money";

/* "Radar dei diritti" forms: what's needed for the rent deduction, and the company welfare. */

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const year = (message: string, min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
    z.number(message).int(message).min(min, message).max(max, message).nullable(),
  );

const optionalAmount = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v?.trim()) return null;
    const parsed = parseAmount(v);
    if (parsed === null) {
      ctx.addIssue({ code: "custom", message: "Importo non valido (es. 350)" });
      return z.NEVER;
    }
    return Number(parsed);
  });

export function rentProfileSchema(currentYear: number) {
  return z.object({
    incomeBand: z.preprocess(
      emptyToNull,
      z.enum(INCOME_BANDS, "Scegli la fascia di reddito").nullable(),
    ),
    birthYear: year("Scrivi l'anno di nascita (es. 1998)", 1920, currentYear),
    contract: z.preprocess(emptyToNull, z.enum(RENT_CONTRACTS, "Contratto non valido").nullable()),
    since: year("Scrivi l'anno in cui è iniziato il contratto", 1980, currentYear + 1),
    transferred: z.boolean().default(false),
  });
}

export const welfareSchema = z.object({
  balance: optionalAmount,
  expiresOn: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida")
      .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Data non valida")
      .nullable(),
  ),
  fringe: optionalAmount,
});
