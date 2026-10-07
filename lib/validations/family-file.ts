import { z } from "zod";
import { NOTE_MAX_LENGTH, NOTE_SECTIONS, SHARE_DAYS, type NoteKey } from "@/lib/family-file";

/* "Il fascicolo di famiglia" forms: the notes and the links for a trusted person. */

const note = z
  .string()
  .max(NOTE_MAX_LENGTH, `Massimo ${NOTE_MAX_LENGTH} caratteri`)
  .optional()
  .transform((v) => (v ?? "").trim());

export const notesSchema = z.object(
  Object.fromEntries(NOTE_SECTIONS.map((s) => [s.key, note])) as Record<NoteKey, typeof note>,
);

export const shareSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Scrivi per chi è, per riconoscerlo nell'elenco")
    .max(60, "Massimo 60 caratteri"),
  days: z.coerce
    .number()
    .refine((d) => (SHARE_DAYS as readonly number[]).includes(d), "Scegli per quanti giorni"),
  showAmounts: z.boolean().default(false),
});
