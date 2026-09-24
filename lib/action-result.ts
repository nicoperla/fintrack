import { z } from "zod";

export type ActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Non-blocking notices shown after a successful action (e.g. a budget nearing its limit). */
  warnings?: string[];
};

export function validationError(error: z.ZodError): ActionResult {
  return { ok: false, fieldErrors: z.flattenError(error).fieldErrors };
}
