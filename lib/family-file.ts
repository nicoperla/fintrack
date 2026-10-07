/*
 * "Il fascicolo di famiglia": the map of what the family owns and owes (accounts, investments,
 * debts, what to cancel) and the notes only the user knows (where the documents are, who to
 * call), for the person they trust. By default it says where things are, not how much: amounts
 * appear only when the user asks. It's not a will, and it must never hold passwords.
 */

export const NOTE_SECTIONS = [
  {
    key: "documenti",
    title: "Dove sono i documenti",
    hint: "Contratti, polizze, atti di proprietà, dichiarazioni dei redditi: in che cassetto, cartella o cloud.",
  },
  {
    key: "contatti",
    title: "Chi chiamare",
    hint: "Commercialista, banca, assicuratore, notaio, datore di lavoro: nomi e numeri.",
  },
  {
    key: "polizze",
    title: "Polizze e previdenza",
    hint: "Assicurazioni vita, fondo pensione, TFR: con quale compagnia e dove trovare il contratto.",
  },
  {
    key: "istruzioni",
    title: "Cose da sapere",
    hint: "Bollette da volturare, abbonamenti da disdire, accordi presi: con parole tue.",
  },
] as const;

export type NoteKey = (typeof NOTE_SECTIONS)[number]["key"];
export type FamilyNotes = Record<NoteKey, string>;

export const NOTE_MAX_LENGTH = 3000;

export function readNotes(raw: unknown): FamilyNotes {
  const o = (raw ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    NOTE_SECTIONS.map((s) => [
      s.key,
      typeof o[s.key] === "string" ? (o[s.key] as string).slice(0, NOTE_MAX_LENGTH) : "",
    ]),
  ) as FamilyNotes;
}

/**
 * What must never end up in the file: "password: …", "PIN = 1234", a card number. A warning,
 * not a block: "il PIN è nella busta in cassaforte" is fine.
 */
export function secretWarnings(text: string) {
  const warnings: string[] = [];
  if (/\b(password|passwd|pwd|pin|puk|cvv|cvc|otp)\b\s*[:=]\s*\S+/i.test(text)) {
    warnings.push("Sembra che tu abbia scritto una password o un codice: toglilo, qui non va.");
  }
  if (/\b\d(?:[ -]?\d){12,18}\b/.test(text)) {
    warnings.push("Sembra un numero di carta: scrivi solo dove si trova la carta, non il numero.");
  }
  return warnings;
}

// ---------- The content ----------

const ACCOUNT_KINDS: Record<string, string> = {
  CHECKING: "Conto corrente",
  CASH: "Contanti",
  CARD: "Carta",
  SAVINGS: "Risparmi",
  INVESTMENT: "Investimenti",
};

const FREQUENCIES: Record<string, string> = {
  weekly: "ogni settimana",
  biweekly: "ogni due settimane",
  monthly: "ogni mese",
  quarterly: "ogni tre mesi",
  yearly: "ogni anno",
};

export type FamilyFileInput = {
  spaceName: string;
  currency: string;
  today: string;
  people: string[];
  accounts: {
    name: string;
    type: string;
    currency: string;
    balance: number;
    archived: boolean;
  }[];
  investments: { name: string; currency: string; value: number; valuedAt: string | null }[];
  debts: { name: string; balance: number; interestRate: number; minimumPayment: number }[];
  recurring: { name: string; frequency: string; amount: number; nextDate: string }[];
  notes: FamilyNotes;
};

/** Everything the file shows, with the amounts left out unless `showAmounts`. */
export function buildFamilyFile(input: FamilyFileInput, { showAmounts }: { showAmounts: boolean }) {
  const amount = (n: number) => (showAmounts ? n : null);
  return {
    spaceName: input.spaceName,
    currency: input.currency,
    generatedOn: input.today,
    showAmounts,
    people: input.people,
    // Archived accounts stay: a forgotten account is exactly what the family has to find.
    accounts: input.accounts
      .filter((a) => a.type !== "INVESTMENT")
      .map((a) => ({
        name: a.name,
        kind: ACCOUNT_KINDS[a.type] ?? a.type,
        currency: a.currency,
        balance: amount(a.balance),
        archived: a.archived,
      })),
    investments: input.investments.map((i) => ({
      name: i.name,
      currency: i.currency,
      value: amount(i.value),
      valuedAt: i.valuedAt,
    })),
    debts: input.debts.map((d) => ({
      name: d.name,
      balance: amount(d.balance),
      interestRate: d.interestRate,
      minimumPayment: amount(d.minimumPayment),
    })),
    recurring: input.recurring.map((r) => ({
      name: r.name,
      frequency: FREQUENCIES[r.frequency] ?? r.frequency,
      amount: amount(r.amount),
    })),
    notes: NOTE_SECTIONS.flatMap((s) =>
      input.notes[s.key].trim() ? [{ title: s.title, text: input.notes[s.key].trim() }] : [],
    ),
  };
}

export type FamilyFileContent = ReturnType<typeof buildFamilyFile>;

// ---------- Sharing ----------

export const SHARE_DAYS = [7, 30] as const;
/** Links alive at the same time, per space. */
export const MAX_ACTIVE_SHARES = 5;

/** A token as the links carry it: anything else is turned away before touching the database. */
export const isShareToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);

export function shareState(
  share: { expiresAt: Date; revokedAt: Date | null },
  now: Date,
): "active" | "expired" | "revoked" {
  if (share.revokedAt) return "revoked";
  return share.expiresAt > now ? "active" : "expired";
}
