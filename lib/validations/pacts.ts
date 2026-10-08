import { z } from "zod";
import { PACT_STARTS, PROMISE_MAX, REFEREE_MAX } from "@/lib/finance/pacts";
import { parseAmount } from "@/lib/finance/money";

/* "Il patto": the limit, the period and at least one stake. */

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : (v ?? null));

/** A positive amount up to `max`, typed the Italian way ("150", "1.234,50"). */
const amount = (message: string, max: number) =>
  z.string().transform((v, ctx) => {
    const parsed = parseAmount(v ?? "");
    if (parsed === null || Number(parsed) <= 0 || Number(parsed) > max) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return Number(parsed);
  });

export const pactSchema = z
  .object({
    categoryId: z.string().min(1, "Scegli la categoria"),
    limit: amount("Scrivi il limite (es. 150)", 100_000),
    start: z.enum(PACT_STARTS, "Scegli quando parte"),
    onlyMine: z.boolean(),
    refereeName: z.preprocess(
      emptyToNull,
      z.string().trim().max(REFEREE_MAX, `Al massimo ${REFEREE_MAX} caratteri`).nullable(),
    ),
    promise: z.preprocess(
      emptyToNull,
      z.string().trim().max(PROMISE_MAX, `Al massimo ${PROMISE_MAX} caratteri`).nullable(),
    ),
    fineAmount: z.preprocess(emptyToNull, amount("Scrivi la multa (es. 30)", 10_000).nullable()),
    goalId: z.preprocess(emptyToNull, z.string().min(1).nullable()),
  })
  .superRefine((v, ctx) => {
    if (v.fineAmount !== null && v.goalId === null) {
      ctx.addIssue({ code: "custom", path: ["goalId"], message: "Scegli dove va la multa" });
    }
    if (v.refereeName === null && v.promise === null && v.fineAmount === null) {
      ctx.addIssue({
        code: "custom",
        path: ["stake"],
        message: "Senza una posta è solo un budget: scegli un arbitro, una promessa o una multa.",
      });
    }
  });

export type PactInput = z.infer<typeof pactSchema>;
