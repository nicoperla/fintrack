import { z } from "zod";
import { FUND_CATEGORIES } from "@/lib/finance/fund-costs";
import { parseAmount } from "@/lib/finance/money";

/* "Radiografia dei costi": the percentages read in the KID. */

/** "1,85", "1.85%", "0,075": a percentage up to `max`, with up to three decimals. */
const percent = (max: number, required: boolean) =>
  z.string().transform((v, ctx) => {
    const text = v.replace(/[\s%]/g, "").replace(",", ".");
    if (!text) {
      if (!required) return 0;
      ctx.addIssue({ code: "custom", message: "Scrivi la percentuale (es. 1,85)" });
      return z.NEVER;
    }
    const n = /^\d+(\.\d{1,3})?$/.test(text) ? Number(text) : NaN;
    if (!Number.isFinite(n) || n > max) {
      ctx.addIssue({ code: "custom", message: `Una percentuale tra 0 e ${max} (es. 1,85)` });
      return z.NEVER;
    }
    return n;
  });

export const fundCostsSchema = z.object({
  accountId: z.string().min(1),
  category: z.enum(FUND_CATEGORIES, "Scegli che prodotto è"),
  entry: percent(20, false),
  exit: percent(20, false),
  ongoing: percent(10, true),
  transaction: percent(5, false),
  performance: percent(5, false),
  monthly: z.string().transform((v, ctx) => {
    if (!v.trim()) return null;
    const parsed = parseAmount(v);
    if (parsed === null || Number(parsed) > 100_000) {
      ctx.addIssue({ code: "custom", message: "Importo non valido (es. 200)" });
      return z.NEVER;
    }
    return Number(parsed) || null;
  }),
});
