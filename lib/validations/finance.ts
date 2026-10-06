import { z } from "zod";
import { parseAmount, parseSignedAmount } from "@/lib/finance/money";
import { CATEGORY_ICON_NAMES } from "@/lib/category-style";
import { isCurrency } from "@/lib/currency/currencies";

export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isCurrency, "Valuta non supportata");

const id = z.string().trim().min(1).max(40);
const optionalId = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((v) => v || null);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida")
  .transform((v) => new Date(`${v}T00:00:00.000Z`))
  .refine((d) => !Number.isNaN(d.getTime()), "Data non valida")
  .refine(
    (d) => d.getUTCFullYear() >= 1970 && d.getUTCFullYear() <= 2100,
    "La data deve essere tra il 1970 e il 2100",
  );

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Inserisci un nome").max(60, "Massimo 60 caratteri"),
  type: z.enum(["CHECKING", "CASH", "CARD", "SAVINGS", "INVESTMENT"], "Scegli un tipo di conto"),
  initialBalance: z.string().transform((v, ctx) => {
    const parsed = parseSignedAmount(v || "0");
    if (parsed === null) {
      ctx.addIssue({ code: "custom", message: "Importo non valido (es. 1250,00 o -300)" });
      return z.NEVER;
    }
    return parsed;
  }),
  /** Omitted: the space's base currency. */
  currency: currencySchema.optional(),
});

/** The value of an investment account on a day, as the bank or broker shows it. */
export const valuationSchema = z.object({
  accountId: id,
  date: isoDate.refine(
    // A day of slack for time zones: the form defaults to today in Italy.
    (d) => d.getTime() <= Date.now() + 86_400_000,
    "Il valore non può essere di una data futura",
  ),
  value: z.string().transform((v, ctx) => {
    const parsed = parseAmount(v);
    if (parsed === null) {
      ctx.addIssue({ code: "custom", message: "Valore non valido (es. 12.450,30)" });
      return z.NEVER;
    }
    return parsed;
  }),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Inserisci un nome").max(40, "Massimo 40 caratteri"),
  type: z.enum(["INCOME", "EXPENSE"], "Scegli se è una categoria di entrata o di uscita"),
  parentId: optionalId,
  icon: z.enum(CATEGORY_ICON_NAMES, "Scegli un'icona"),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Colore non valido"),
});

const tagList = z
  .string()
  .optional()
  .transform((v) =>
    Array.from(
      new Set(
        (v ?? "")
          .split(",")
          .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
          .filter(Boolean),
      ),
    ),
  )
  .pipe(
    z
      .array(z.string().max(30, "Ogni tag può avere al massimo 30 caratteri"))
      .max(10, "Massimo 10 tag"),
  );

export const transactionSchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"], "Scegli il tipo di movimento"),
    amount: z.string().transform((v, ctx) => {
      const parsed = parseAmount(v);
      if (parsed === null || Number(parsed) <= 0) {
        ctx.addIssue({
          code: "custom",
          message: "Inserisci un importo maggiore di zero (es. 12,50)",
        });
        return z.NEVER;
      }
      return parsed;
    }),
    date: isoDate,
    description: z.string().trim().max(120, "Massimo 120 caratteri"),
    accountId: z.string().trim().min(1, "Scegli un conto").max(40),
    transferAccountId: optionalId,
    /** TRANSFER between accounts in different currencies: what the destination receives. */
    transferAmount: z
      .string()
      .optional()
      .transform((v, ctx) => {
        if (!v?.trim()) return null;
        const parsed = parseAmount(v);
        if (parsed === null || Number(parsed) <= 0) {
          ctx.addIssue({ code: "custom", message: "Importo ricevuto non valido (es. 108,40)" });
          return z.NEVER;
        }
        return parsed;
      }),
    categoryId: optionalId,
    notes: z
      .string()
      .trim()
      .max(500, "Massimo 500 caratteri")
      .optional()
      .transform((v) => v || null),
    tags: tagList,
  })
  .superRefine((data, ctx) => {
    if (data.type === "TRANSFER") {
      if (!data.transferAccountId) {
        ctx.addIssue({
          code: "custom",
          path: ["transferAccountId"],
          message: "Scegli il conto di destinazione",
        });
      } else if (data.transferAccountId === data.accountId) {
        ctx.addIssue({
          code: "custom",
          path: ["transferAccountId"],
          message: "Scegli un conto diverso da quello di origine",
        });
      }
    } else if (!data.description) {
      ctx.addIssue({ code: "custom", path: ["description"], message: "Inserisci una descrizione" });
    }
  })
  .transform((data) =>
    data.type === "TRANSFER"
      ? { ...data, categoryId: null, description: data.description || "Trasferimento" }
      : { ...data, transferAccountId: null, transferAmount: null },
  );

export type TransactionInput = z.output<typeof transactionSchema>;

// Each filter falls back to undefined when malformed, so a bad URL never breaks the page.
const loose = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

export const transactionFiltersSchema = z.object({
  q: loose(
    z
      .string()
      .trim()
      .max(100)
      .transform((v) => v || undefined),
  ),
  type: loose(z.enum(["INCOME", "EXPENSE", "TRANSFER"])),
  accountId: loose(id),
  categoryId: loose(z.union([z.literal("none"), id])),
  from: loose(isoDate),
  to: loose(isoDate),
  min: loose(z.string().transform((v) => parseAmount(v) ?? undefined)),
  max: loose(z.string().transform((v) => parseAmount(v) ?? undefined)),
  page: loose(z.coerce.number().int().min(1).max(10_000)),
});

export type TransactionFilters = z.output<typeof transactionFiltersSchema>;
