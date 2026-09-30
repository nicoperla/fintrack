import { z } from "zod";

/*
 * How the user wants to manage money. The coach judges the numbers against these choices, not
 * against a one-size-fits-all rule.
 */

export const COACH_METHODS = {
  "50-30-20": {
    label: "50/30/20",
    summary: "Metà ai bisogni, il 30% ai desideri, il 20% ai risparmi.",
    savingsTarget: 20,
  },
  "paga-te-stesso": {
    label: "Prima paga te stesso",
    summary:
      "Appena arriva lo stipendio metti da parte una quota fissa; il resto lo spendi sereno.",
    savingsTarget: 15,
  },
  buste: {
    label: "Un budget per ogni cosa",
    summary: "Ogni euro ha un compito: un tetto per categoria, controllato mese per mese.",
    savingsTarget: 15,
  },
  fire: {
    label: "Libertà finanziaria",
    summary: "Risparmi tanto e presto, per non dipendere per sempre dallo stipendio.",
    savingsTarget: 40,
  },
  sereno: {
    label: "Vivere sereno",
    summary: "Prima un cuscinetto per gli imprevisti, poi il resto. Nessuna rinuncia estrema.",
    savingsTarget: 10,
  },
} as const;

export type CoachMethod = keyof typeof COACH_METHODS;

export const COACH_PRIORITIES = {
  "fondo-emergenza": "Un cuscinetto per gli imprevisti",
  debiti: "Liberarmi dai debiti",
  vizi: "Spendere meno in fumo e scommesse",
  casa: "Comprare casa",
  viaggi: "Viaggiare di più",
  investire: "Far crescere i risparmi",
  pensione: "Pensare alla pensione",
  figli: "Il futuro dei figli",
} as const;

export type CoachPriority = keyof typeof COACH_PRIORITIES;

export const COACH_TONES = {
  gentile: { label: "Gentile", summary: "Incoraggiante, senza giudicare." },
  diretto: { label: "Diretto", summary: "Numeri e fatti, senza giri di parole." },
  motivante: { label: "Da allenatore", summary: "Energico, ti sprona a fare di più." },
} as const;

export type CoachTone = keyof typeof COACH_TONES;

const methodKeys = Object.keys(COACH_METHODS) as [CoachMethod, ...CoachMethod[]];
const priorityKeys = Object.keys(COACH_PRIORITIES) as [CoachPriority, ...CoachPriority[]];
const toneKeys = Object.keys(COACH_TONES) as [CoachTone, ...CoachTone[]];

export const coachProfileSchema = z.object({
  method: z.enum(methodKeys),
  savingsTarget: z.coerce
    .number("Inserisci una percentuale")
    .int("Solo numeri interi")
    .min(0, "Almeno 0%")
    .max(80, "Al massimo 80%"),
  emergencyMonths: z.coerce
    .number("Inserisci i mesi")
    .int("Solo mesi interi")
    .min(1, "Almeno 1 mese")
    .max(12, "Al massimo 12 mesi"),
  priorities: z.array(z.enum(priorityKeys)).max(8),
  /** Categories the coach never suggests cutting: what the user won't give up. */
  protectedCategoryIds: z.array(z.string().min(1).max(40)).max(40),
  tone: z.enum(toneKeys),
  /** In the user's words: what they want from their money. */
  note: z.string().trim().max(500, "Massimo 500 caratteri"),
});

export type CoachProfile = z.infer<typeof coachProfileSchema>;

export const DEFAULT_COACH_PROFILE: CoachProfile = {
  method: "50-30-20",
  savingsTarget: 20,
  emergencyMonths: 3,
  priorities: ["fondo-emergenza"],
  protectedCategoryIds: [],
  tone: "gentile",
  note: "",
};

/** The stored profile, or the defaults when it's missing or no longer valid. */
export function readCoachProfile(stored: unknown): { profile: CoachProfile; configured: boolean } {
  if (stored === null || stored === undefined) {
    return { profile: DEFAULT_COACH_PROFILE, configured: false };
  }
  const parsed = coachProfileSchema.safeParse({ ...DEFAULT_COACH_PROFILE, ...(stored as object) });
  return parsed.success
    ? { profile: parsed.data, configured: true }
    : { profile: DEFAULT_COACH_PROFILE, configured: false };
}
