import { z } from "zod";
import { JOURNEY_KEYS } from "@/lib/journeys/catalog";
import { DOC_KINDS } from "@/lib/journeys/documents";

/* "Percorsi e scadenze": the forms. */

const isoDate = (message: string) =>
  z
    .string(message)
    .regex(/^\d{4}-\d{2}-\d{2}$/, message)
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), message);

export const journeyKeySchema = z.enum(JOURNEY_KEYS, "Percorso non valido");

export const startJourneySchema = z.object({
  key: journeyKeySchema,
  eventDate: isoDate("Scegli una data"),
});

export const stepKeySchema = z.string().regex(/^[a-z0-9-]{1,40}$/, "Passo non valido");

export const documentSchema = z.object({
  kind: z.enum(DOC_KINDS, "Scegli il tipo di documento"),
  label: z.string().trim().min(1, "Scrivi un nome").max(60, "Al massimo 60 caratteri"),
  expiresOn: isoDate("Scegli la data di scadenza"),
});
