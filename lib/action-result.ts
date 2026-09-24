import { z } from "zod";

export type ActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export function validationError(error: z.ZodError): ActionResult {
  return { ok: false, fieldErrors: z.flattenError(error).fieldErrors };
}
