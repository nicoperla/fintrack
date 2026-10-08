import { z } from "zod";
import { DECISION_MAX } from "@/lib/finance/money-talk";

/* "Il caffè dei conti": a decision written down at the end of the talk. */

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

export const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mese non valido");

/** `today` is "YYYY-MM-DD" in Italy: a deadline can't be in the past. */
export const decisionSchema = (today: string) =>
  z.object({
    month: monthKeySchema,
    topic: z.preprocess(emptyToNull, z.string().trim().max(80).nullable()),
    text: z
      .string()
      .trim()
      .min(3, "Scrivete cosa avete deciso (es. spesa online una volta a settimana)")
      .max(DECISION_MAX, `Al massimo ${DECISION_MAX} caratteri: una frase basta`),
    /** A member of the space; empty: together. */
    ownerId: z.preprocess(emptyToNull, z.string().min(1).nullable()),
    dueOn: z.preprocess(
      emptyToNull,
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida")
        .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Data non valida")
        .refine((v) => v >= today, "Scegliete una data da oggi in poi")
        .nullable(),
    ),
  });
