import { z } from "zod";
import { parseAmount } from "@/lib/finance/money";
import { HOMES, LIFE_EVENTS, OTHER_INCOMES, WORK_KINDS } from "@/lib/tax/situation";
import { CU_KINDS } from "@/lib/tax/simulate";
import { HOME_BONUS_KINDS } from "@/lib/finance/rights";

/* "Il mio 730": the forms. Amounts are typed the Italian way ("1.234,56"). */

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const amount = (message: string) =>
  z.union([z.string(), z.number()]).transform((v, ctx) => {
    const parsed = typeof v === "number" ? v : parseAmount(v);
    if (parsed === null || Number(parsed) < 0) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return Math.round(Number(parsed) * 100) / 100;
  });

/** A year Orbitly can follow: the 730 of the last few years and the one being prepared. */
export const taxYearSchema = (current: number) =>
  z.coerce
    .number("Anno non valido")
    .int("Anno non valido")
    .min(current - 6, "Anno non valido")
    .max(current, "Anno non valido");

export const situationSchema = z.object({
  work: z.enum(WORK_KINDS, "Scegli che lavoro hai fatto"),
  moreEmployers: z.boolean().default(false),
  agent: z.preprocess(emptyToNull, z.boolean().nullable()).default(null),
  home: z.enum(HOMES, "Scegli dove vivi"),
  spouse: z.boolean().default(false),
  children: z.coerce.number("Numero non valido").int().min(0).max(10).default(0),
  childrenShare: z.union([z.literal(50), z.literal(100)]).default(50),
  parents: z.coerce.number("Numero non valido").int().min(0).max(4).default(0),
  childIncomeRisk: z.boolean().default(false),
  otherIncome: z.array(z.enum(OTHER_INCOMES)).max(OTHER_INCOMES.length).default([]),
  events: z.array(z.enum(LIFE_EVENTS)).max(LIFE_EVENTS.length).default([]),
});

export const cuEntrySchema = z.object({
  kind: z.enum(CU_KINDS, "Scegli il tipo di reddito"),
  income: amount("Scrivi il reddito (punto 1, 2 o 3 della CU)"),
  days: z.coerce
    .number("Scrivi i giorni (punto 6 o 7)")
    .int("Scrivi i giorni (punto 6 o 7)")
    .min(0, "I giorni vanno da 0 a 365")
    .max(365, "I giorni vanno da 0 a 365"),
  withheld: amount("Scrivi le ritenute IRPEF (punto 21)"),
  fixedTerm: z.boolean().default(false),
});

export const cuSchema = z.object({
  entries: z.array(cuEntrySchema).max(6, "Al massimo 6 CU"),
});

export const docKeySchema = z.string().regex(/^[a-z0-9-]{1,40}$/, "Documento non valido");
export const docStateSchema = z.enum(["have", "skip"]).nullable();

export const decisionSchema = z.enum(["ACCEPT", "MODIFY", "CAF"]).nullable();

export const sentSchema = z.object({
  channel: z.enum(["SELF", "CAF"], "Scegli come l'hai inviato"),
  sentAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida")
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Data non valida"),
});

/** The 730-3: what comes back (or is due) and the November advance. */
export const resultSchema = z.object({
  direction: z.enum(["refund", "debt", "zero"], "Scegli rimborso o debito"),
  amount: z.preprocess(emptyToNull, amount("Importo non valido (es. 280)").nullable()),
  secondAdvance: z.preprocess(emptyToNull, amount("Importo non valido (es. 120)").nullable()),
});

export const homeBonusSchema = (current: number) =>
  z.object({
    kind: z.enum(HOME_BONUS_KINDS, "Scegli il tipo di lavori"),
    year: z.coerce
      .number("Scrivi l'anno in cui hai pagato")
      .int("Scrivi l'anno in cui hai pagato")
      .min(current - 10, "Contano i lavori degli ultimi dieci anni")
      .max(current, "L'anno non può essere nel futuro"),
    amount: amount("Scrivi quanto hai speso (es. 12.000)").refine(
      (n) => n > 0,
      "Scrivi quanto hai speso",
    ),
    rate: z.coerce
      .number("Scrivi la percentuale")
      .min(1, "La percentuale va da 1 a 110")
      .max(110, "La percentuale va da 1 a 110"),
    label: z.string().trim().max(60, "Al massimo 60 caratteri").default(""),
  });

export const iseeSchema = (current: number) =>
  z.object({
    value: z.preprocess(emptyToNull, amount("Scrivi il valore dell'ISEE (es. 18.500)").nullable()),
    year: z.coerce
      .number()
      .int()
      .min(current - 1)
      .max(current + 1),
  });
