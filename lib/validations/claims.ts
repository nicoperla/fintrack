import { z } from "zod";
import { CLAIM_CHANNELS, CLAIM_KINDS, OUTCOME_STATUSES } from "@/lib/finance/claims";
import { parseAmount } from "@/lib/finance/money";

/*
 * "Riprenditeli" forms. Dates stay YYYY-MM-DD strings (lib/finance/claims.ts works on those);
 * amounts become canonical "1234.56" strings, like the rest of the app.
 */

const DAY_MS = 86_400_000;

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Data non valida")
  .refine((v) => v >= "2000-01-01" && v <= "2100-12-31", "Data non valida");

// A day of slack for time zones: the forms default to today in Italy.
const pastDay = (message: string) =>
  isoDay.refine((v) => Date.parse(`${v}T00:00:00Z`) <= Date.now() + DAY_MS, message);

const optional = <T extends z.ZodType<unknown, string>>(schema: T) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .pipe(schema.optional())
    .transform((v) => v ?? null);

const amount = (message: string) =>
  z.string().transform((v, ctx) => {
    const parsed = parseAmount(v);
    if (parsed === null || Number(parsed) <= 0) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return parsed;
  });

export const openClaimSchema = z
  .object({
    kind: z.enum(CLAIM_KINDS, "Scegli cosa vuoi ottenere"),
    counterparty: z
      .string()
      .trim()
      .min(1, "Scrivi a chi ti rivolgi")
      .max(80, "Massimo 80 caratteri"),
    amount: amount("Inserisci un importo maggiore di zero (es. 49,90)"),
    chargeDate: optional(pastDay("L'addebito non può essere nel futuro")),
    effectiveFrom: optional(isoDay),
    findingKey: optional(z.string().max(300)),
    transactionId: optional(z.string().max(40)),
  })
  .superRefine((data, ctx) => {
    if (data.kind === "DIRECT_DEBIT_REFUND" && !data.transactionId && !data.chargeDate) {
      ctx.addIssue({
        code: "custom",
        path: ["chargeDate"],
        message: "Indica la data dell'addebito: le 8 settimane partono da lì",
      });
    }
  });

export type OpenClaimInput = z.output<typeof openClaimSchema>;

export const letterSchema = z.object({
  subject: z.string().trim().min(1, "Scrivi l'oggetto").max(200, "Massimo 200 caratteri"),
  body: z.string().trim().min(1, "La lettera è vuota").max(8000, "Massimo 8000 caratteri"),
});

export const markSentSchema = z.object({
  channel: z.enum(CLAIM_CHANNELS, "Scegli come l'hai inviata"),
  sentAt: pastDay("La data di invio non può essere nel futuro"),
  /** CANCELLATION only: required there, checked by the action that knows the kind. */
  effectiveFrom: optional(isoDay),
});

export const outcomeSchema = z
  .object({
    status: z.enum(OUTCOME_STATUSES, "Scegli com'è finita"),
    recoveredAmount: z
      .string()
      .optional()
      .transform((v, ctx) => {
        if (!v?.trim()) return null;
        const parsed = parseAmount(v);
        if (parsed === null) {
          ctx.addIssue({ code: "custom", message: "Importo non valido (es. 49,90)" });
          return z.NEVER;
        }
        return parsed;
      }),
    notes: z
      .string()
      .trim()
      .max(500, "Massimo 500 caratteri")
      .optional()
      .transform((v) => v || null),
  })
  .superRefine((data, ctx) => {
    const gotSomething = data.status === "WON" || data.status === "PARTIAL";
    if (gotSomething && (data.recoveredAmount === null || Number(data.recoveredAmount) <= 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["recoveredAmount"],
        message: "Scrivi quanto hai recuperato (es. 49,90)",
      });
    }
  })
  // Lost or dropped: nothing came back, whatever was typed.
  .transform((data) =>
    data.status === "WON" || data.status === "PARTIAL" ? data : { ...data, recoveredAmount: null },
  );
