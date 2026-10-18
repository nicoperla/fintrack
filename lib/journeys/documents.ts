/*
 * "Scadenze dei documenti": the documents that expire and how to renew each one in time. Only
 * kind, name and date are stored: never numbers or pictures.
 */

export const DOC_KINDS = [
  "CIE",
  "PASSAPORTO",
  "PATENTE",
  "TESSERA",
  "REVISIONE",
  "PERMESSO",
  "ALTRO",
] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const DOC_KIND_INFO: Record<DocKind, { label: string; renew: string; leadDays: number }> = {
  CIE: {
    label: "Carta d'identità",
    renew:
      "Si prenota al Comune (anche dall'Agenda CIE online): conviene muoversi qualche mese prima, i posti finiscono presto.",
    leadDays: 120,
  },
  PASSAPORTO: {
    label: "Passaporto",
    renew:
      "Si prenota in Questura dall'Agenda passaporto della Polizia di Stato, con il bollettino e la marca da bollo.",
    leadDays: 120,
  },
  PATENTE: {
    label: "Patente",
    renew:
      "Visita medica da un medico abilitato (anche in un'autoscuola): la conferma del rinnovo arriva poi a casa.",
    leadDays: 60,
  },
  TESSERA: {
    label: "Tessera sanitaria",
    renew:
      "La nuova di solito arriva da sola a casa prima della scadenza; se no, chiedila all'ASL o all'Agenzia delle Entrate.",
    leadDays: 30,
  },
  REVISIONE: {
    label: "Revisione dell'auto",
    renew:
      "Ogni due anni (la prima dopo quattro), entro il mese della scadenza, in un centro autorizzato o alla Motorizzazione.",
    leadDays: 30,
  },
  PERMESSO: {
    label: "Permesso di soggiorno",
    renew: "Il rinnovo si chiede almeno 60 giorni prima della scadenza, con il kit delle Poste.",
    leadDays: 90,
  },
  ALTRO: {
    label: "Altro documento",
    renew: "Controlla per tempo come si rinnova.",
    leadDays: 30,
  },
};

const DAY_MS = 86_400_000;
export const daysUntil = (today: string, date: string) =>
  Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);

export type DocStatus = "expired" | "renew" | "soon" | "ok";

/**
 * Expired, time to renew (inside the kind's lead time), coming up (within a year) or fine. The
 * lead time is longer for documents with long waiting lists, like the identity card.
 */
export function docStatus(kind: DocKind, expiresOn: string, today: string): DocStatus {
  const days = daysUntil(today, expiresOn);
  if (days < 0) return "expired";
  if (days <= DOC_KIND_INFO[kind].leadDays) return "renew";
  if (days <= 365) return "soon";
  return "ok";
}

export const isDocKind = (v: unknown): v is DocKind => DOC_KINDS.includes(v as DocKind);
