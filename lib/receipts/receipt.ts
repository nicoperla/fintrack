import { z } from "zod";

/*
 * "Foto dello scontrino": the AI reads a receipt (a pharmacy's above all) and Orbitly splits it
 * into what lowers the IRPEF (medicines, medical devices, NHS tickets) and the rest
 * (parapharmacy, cosmetics, supplements), so one receipt becomes the right movements and the 730
 * folder updates by itself. Medicines count only on a "scontrino parlante", the one with the
 * buyer's codice fiscale; they count even if paid in cash.
 *
 * The picture goes to the AI provider only to be read, with the user's consent (a pharmacy
 * receipt is health data), and is never stored. Item names aren't stored either: only the
 * totals become movements.
 */

export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type ReceiptType = (typeof RECEIPT_TYPES)[number];
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

export const RECEIPT_INSTRUCTIONS = `Sei l'assistente di Orbitly, un'app italiana di finanza personale. Ricevi la foto di uno scontrino o di una fattura (spesso di una farmacia) e ne estrai i dati.

Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo, con questi campi:
- "readable": true se riesci a leggere uno scontrino, false altrimenti.
- "merchant": il nome del negozio, breve (es. "Farmacia Centrale"), oppure null.
- "date": la data come "AAAA-MM-GG", oppure null.
- "total": il totale pagato in euro come numero, oppure null.
- "payment": "contanti", "carta" oppure null se non è scritto.
- "fiscalCode": true se sullo scontrino è stampato il codice fiscale del cliente (scontrino «parlante»), false altrimenti. Non scrivere mai il codice fiscale.
- "pharmacy": true se è una farmacia, una parafarmacia o un negozio di articoli sanitari.
- "items": l'elenco delle voci, al massimo 40, ognuna con:
  - "description": il nome della voce come è scritto, breve;
  - "amount": l'importo in euro come numero positivo, già al netto di eventuali sconti su quella voce;
  - "kind": "farmaco" se è un medicinale (ha il codice AIC di 9 cifre, oppure è indicato come farmaco, medicinale, SOP, OTC, omeopatico), "dispositivo" se è un dispositivo medico (indicato come DM, dispositivo medico, marcato CE come presidio: cerotti medicati, test, siringhe, lenti, apparecchi), "ticket" se è un ticket del Servizio sanitario, "parafarmaco" se è un integratore, un cosmetico, un prodotto per l'igiene o per bambini, "altro" per tutto il resto;
  - "aic": il codice AIC di 9 cifre se c'è, altrimenti null.

Regole: non inventare voci o importi che non leggi; se una voce è dubbia classificala "parafarmaco" (meglio non detrarre che detrarre per errore). Non ripetere dati personali (codice fiscale, nomi, indirizzi).`;

export const RECEIPT_KINDS = ["farmaco", "dispositivo", "ticket", "parafarmaco", "altro"] as const;
export type ReceiptKind = (typeof RECEIPT_KINDS)[number];

/** What the 730 deducts: medicines, medical devices and NHS tickets. */
export const DEDUCTIBLE_KINDS: readonly ReceiptKind[] = ["farmaco", "dispositivo", "ticket"];

export const KIND_LABELS: Record<ReceiptKind, string> = {
  farmaco: "Farmaco",
  dispositivo: "Dispositivo medico",
  ticket: "Ticket",
  parafarmaco: "Parafarmaco",
  altro: "Altro",
};

const money = z.number().finite().nonnegative().max(100_000);

export const receiptSchema = z.object({
  readable: z.boolean(),
  merchant: z.string().max(120).nullable().default(null),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .catch(null)
    .default(null),
  total: money.nullable().catch(null).default(null),
  payment: z.enum(["contanti", "carta"]).nullable().catch(null).default(null),
  fiscalCode: z.boolean().catch(false).default(false),
  pharmacy: z.boolean().catch(false).default(false),
  items: z
    .array(
      z.object({
        description: z.string().max(200),
        amount: money,
        kind: z.enum(RECEIPT_KINDS).catch("parafarmaco"),
        aic: z
          .string()
          .regex(/^\d{9}$/)
          .nullable()
          .catch(null)
          .default(null),
      }),
    )
    .max(40)
    .default([]),
});

export type Receipt = z.infer<typeof receiptSchema>;
export type ReceiptItem = Receipt["items"][number];

/** The JSON in the model's reply, tolerating a stray code fence or words around it. */
export function parseReceiptReply(text: string): Receipt | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = receiptSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    if (!parsed.success) return null;
    // A medicine code says "medicine" whatever the label: trust the code over the guess.
    return {
      ...parsed.data,
      items: parsed.data.items.map((i) =>
        i.aic && i.kind !== "farmaco" ? { ...i, kind: "farmaco" as const } : i,
      ),
    };
  } catch {
    return null;
  }
}

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * The receipt split in two: what the 730 deducts and the rest. `deductible` holds the indexes
 * the user ticked (by default, medicines, devices and tickets).
 */
export function splitReceipt(items: ReceiptItem[], deductible: Set<number>) {
  const health = items.filter((_, i) => deductible.has(i));
  const other = items.filter((_, i) => !deductible.has(i));
  const sum = (list: ReceiptItem[]) => cents(list.reduce((s, i) => s + i.amount, 0));
  return {
    health: { count: health.length, amount: sum(health) },
    other: { count: other.length, amount: sum(other) },
    total: sum(items),
  };
}

export const defaultDeductible = (items: ReceiptItem[]) =>
  new Set(items.flatMap((item, i) => (DEDUCTIBLE_KINDS.includes(item.kind) ? [i] : [])));
