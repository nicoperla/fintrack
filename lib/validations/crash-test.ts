import { z } from "zod";
import { WORK_KINDS } from "@/lib/finance/crash-test";
import { parseAmount } from "@/lib/finance/money";

/* "Il crash test": the job, for the NASpI. */

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

/** `today`: the current year and month (0-based) in Italy. */
export const crashProfileSchema = (today: { year: number; month: number }) =>
  z.object({
    work: z.enum(WORK_KINDS, "Scegli che lavoro fai"),
    ral: z.preprocess(
      emptyToNull,
      z
        .string()
        .transform((v, ctx) => {
          const parsed = parseAmount(v);
          if (parsed === null || Number(parsed) <= 0 || Number(parsed) > 1_000_000) {
            ctx.addIssue({ code: "custom", message: "Scrivi la RAL in euro (es. 28.000)" });
            return z.NEVER;
          }
          return Number(parsed);
        })
        .nullable(),
    ),
    since: z.preprocess(
      emptyToNull,
      z
        .string()
        .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Scegli mese e anno")
        .refine((v) => {
          const [year, month] = v.split("-").map(Number);
          return (
            year >= 1950 && (year < today.year || (year === today.year && month - 1 <= today.month))
          );
        }, "Scegli un mese passato")
        .nullable(),
    ),
    birthYear: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
      z
        .number("Anno non valido")
        .int("Anno non valido")
        .min(1930, "Anno non valido")
        .max(today.year - 14, "Anno non valido")
        .nullable(),
    ),
  });
