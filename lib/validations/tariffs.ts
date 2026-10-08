import { z } from "zod";
import { AGE_BANDS, BANK_ACCOUNT_KINDS } from "@/lib/finance/tariff-data";
import { isProvince } from "@/lib/finance/tariffs";
import { parseAmount } from "@/lib/finance/money";

/* "Il Tariffometro" forms: where the space lives, the RC auto, the account and the light bill. */

const DAY_MS = 86_400_000;
const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);
const toNumberOrNull = (v: unknown) =>
  v === "" || v === undefined || v === null ? null : Number(v);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Data non valida");

const optionalDate = z.preprocess(emptyToNull, isoDate.nullable());

/** A positive amount up to `max`, typed the Italian way ("480", "1.234,50"). */
const amount = (message: string, max: number) =>
  z.string().transform((v, ctx) => {
    const parsed = parseAmount(v ?? "");
    if (parsed === null || Number(parsed) <= 0 || Number(parsed) > max) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return Number(parsed);
  });

const label = (message: string) =>
  z.string().trim().min(1, message).max(40, "Al massimo 40 caratteri");

export const tariffProfileSchema = z.object({
  province: z.preprocess(
    emptyToNull,
    z.string().refine(isProvince, "Scegli la provincia dall'elenco").nullable(),
  ),
  householdSize: z.preprocess(
    toNumberOrNull,
    z
      .number("Scegli quante persone siete")
      .int("Scegli quante persone siete")
      .min(1, "Scegli quante persone siete")
      .max(10, "Scegli quante persone siete")
      .nullable(),
  ),
});

export const carInsuranceSchema = z.object({
  id: z.string().optional(),
  label: label("Dai un nome all'auto (es. Panda)"),
  premium: amount("Scrivi quanto paghi in un anno (es. 480)", 20_000),
  renewsOn: optionalDate,
  bonusMalus: z.preprocess(
    toNumberOrNull,
    z
      .number("Classe da 1 a 18")
      .int("Classe da 1 a 18")
      .min(1, "Classe da 1 a 18")
      .max(18, "Classe da 1 a 18")
      .nullable(),
  ),
  ageBand: z.preprocess(emptyToNull, z.enum(AGE_BANDS, "Scegli la fascia d'età").nullable()),
});

export const bankAccountSchema = z.object({
  accountId: z.string().min(1, "Conto non trovato"),
  accountKind: z.enum(BANK_ACCOUNT_KINDS, "Scegli che conto è"),
  /** From the bank's "Riepilogo delle spese"; empty: read from the movements. */
  yearly: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v?.trim()) return null;
      const parsed = parseAmount(v);
      if (parsed === null || Number(parsed) > 5_000) {
        ctx.addIssue({ code: "custom", message: "Importo non valido (es. 96,50)" });
        return z.NEVER;
      }
      return Number(parsed);
    }),
});

/** A bill is about days gone by, at most a year of them. */
export function electricitySchema(today: string) {
  return z
    .object({
      id: z.string().optional(),
      label: label("Dai un nome alla fornitura (es. Luce di casa)"),
      amount: amount("Scrivi il totale della bolletta (es. 118,40)", 10_000),
      kwh: z.preprocess(
        toNumberOrNull,
        z
          .number("Scrivi i kWh fatturati (es. 330)")
          .int("Solo numeri interi (es. 330)")
          .min(1, "Scrivi i kWh fatturati (es. 330)")
          .max(100_000, "Troppi kWh per una casa"),
      ),
      periodFrom: isoDate,
      periodTo: isoDate,
      renewsOn: optionalDate,
    })
    .superRefine((v, ctx) => {
      const days = (Date.parse(v.periodTo) - Date.parse(v.periodFrom)) / DAY_MS + 1;
      if (days < 1) {
        ctx.addIssue({ code: "custom", path: ["periodTo"], message: "Viene prima dell'inizio" });
      } else if (days > 366) {
        ctx.addIssue({ code: "custom", path: ["periodTo"], message: "Al massimo un anno" });
      }
      if (v.periodTo > today) {
        ctx.addIssue({
          code: "custom",
          path: ["periodTo"],
          message: "La bolletta riguarda giorni già passati",
        });
      }
    });
}
