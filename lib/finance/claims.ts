import type { ClaimKind, ClaimStatus } from "@prisma/client";
import { looksLikeBankFee } from "@/lib/finance/found-money";
import { normalizeDescription } from "@/lib/finance/recurring";

/*
 * "Riprenditeli": FinTrack doesn't stop at finding lost money (lib/finance/found-money.ts), it
 * helps get it back. The user sends the letters (lib/claims/letters.ts); this module keeps the
 * deadlines the rules set and says what to do next. Dates are YYYY-MM-DD strings.
 *
 * Rules checked in October 2026, informative and not legal advice:
 * - a SEPA direct debit can be refunded for 8 weeks with no reason given, and the bank refunds
 *   or explains its refusal within 10 business days (artt. 13-14 d.lgs. 11/2010, SEPA Core);
 * - a charge never authorized can be disowned for 13 months (art. 9 d.lgs. 11/2010);
 * - banks answer complaints within 15 business days for payment services and 60 days otherwise
 *   (Banca d'Italia's transparency provisions); then there's the Arbitro Bancario Finanziario.
 */

export const CLAIM_KINDS = [
  "CANCELLATION",
  "DIRECT_DEBIT_REFUND",
  "BANK_COMPLAINT",
  "DUPLICATE_CHARGE",
] as const satisfies readonly ClaimKind[];

export const KIND_LABELS: Record<ClaimKind, string> = {
  CANCELLATION: "Disdetta",
  DIRECT_DEBIT_REFUND: "Rimborso di un addebito diretto",
  BANK_COMPLAINT: "Reclamo alla banca",
  DUPLICATE_CHARGE: "Addebito doppio o sbagliato",
};

/** How the user sent the letter. */
export const CLAIM_CHANNELS = ["email", "pec", "raccomandata", "app", "sportello"] as const;
export type ClaimChannel = (typeof CLAIM_CHANNELS)[number];

export const CHANNEL_LABELS: Record<ClaimChannel, string> = {
  email: "Email",
  pec: "PEC",
  raccomandata: "Raccomandata",
  app: "Area clienti o app",
  sportello: "Di persona, allo sportello",
};

/** How a claim can end. */
export const OUTCOME_STATUSES = [
  "WON",
  "PARTIAL",
  "LOST",
  "DROPPED",
] as const satisfies readonly ClaimStatus[];
export type ClaimOutcome = (typeof OUTCOME_STATUSES)[number];

export const isOpenClaim = (status: ClaimStatus) => status === "DRAFT" || status === "SENT";

export const REFUND_WINDOW_DAYS = 56;
export const REFUND_ANSWER_BUSINESS_DAYS = 10;
export const PAYMENT_COMPLAINT_BUSINESS_DAYS = 15;
export const BANKING_COMPLAINT_DAYS = 60;
/** How long to give a merchant before contesting the charge with the bank. */
export const MERCHANT_WAIT_DAYS = 14;
/** From this many days left, a deadline is urgent. */
const URGENT_DAYS = 7;

const DAY_MS = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (time: number) => new Date(time).toISOString().slice(0, 10);
const pad = (n: number) => String(n).padStart(2, "0");
const cents = (n: number) => Math.round(n * 100) / 100;

export const addDays = (iso: string, days: number) => toIso(toTime(iso) + days * DAY_MS);
export const daysBetween = (from: string, to: string) =>
  Math.round((toTime(to) - toTime(from)) / DAY_MS);

/** Easter Sunday in the Gregorian calendar (anonymous algorithm). */
export function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return `${year}-${pad(Math.floor(n / 31))}-${pad((n % 31) + 1)}`;
}

const FIXED_HOLIDAYS = [
  "01-01",
  "01-06",
  "04-25",
  "05-01",
  "06-02",
  "08-15",
  "11-01",
  "12-08",
  "12-25",
  "12-26",
];
// Banks work half a day on Christmas Eve and New Year's Eve: counting them as closed means a
// deadline the bank has to meet is never shown before its real end.
const HALF_DAYS = ["12-24", "12-31"];

const holidays = new Map<number, Set<string>>();

/** National holidays: the fixed ones, Easter Monday and, from 2026, San Francesco (4 October). */
export function italianHolidays(year: number) {
  let days = holidays.get(year);
  if (!days) {
    days = new Set(FIXED_HOLIDAYS.map((monthDay) => `${year}-${monthDay}`));
    days.add(addDays(easterSunday(year), 1));
    if (year >= 2026) days.add(`${year}-10-04`);
    holidays.set(year, days);
  }
  return days;
}

export function isBusinessDay(iso: string) {
  const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  return !HALF_DAYS.includes(iso.slice(5)) && !italianHolidays(Number(iso.slice(0, 4))).has(iso);
}

/** The day `days` business days after `iso` (which doesn't count itself). */
export function addBusinessDays(iso: string, days: number) {
  let day = iso;
  for (let left = days; left > 0;) {
    day = addDays(day, 1);
    if (isBusinessDay(day)) left--;
  }
  return day;
}

/** Last day to ask the bank for a direct debit refund: 8 weeks from the charge. */
export const refundDeadline = (chargeDate: string) => addDays(chargeDate, REFUND_WINDOW_DAYS);

/** While drafting: the last day to act, when the rules set one. */
export function draftDeadline(kind: ClaimKind, chargeDate: string | null) {
  return kind === "DIRECT_DEBIT_REFUND" && chargeDate ? refundDeadline(chargeDate) : null;
}

/**
 * Once sent: the last day for the other side to answer. A complaint about a payment (a charge
 * taken twice, one never authorized) concerns a payment service; one about the account's fees
 * doesn't, and the bank has longer.
 */
export function answerDeadline(kind: ClaimKind, sentAt: string, contestsPayment: boolean) {
  switch (kind) {
    case "DIRECT_DEBIT_REFUND":
      return addBusinessDays(sentAt, REFUND_ANSWER_BUSINESS_DAYS);
    case "BANK_COMPLAINT":
      return contestsPayment
        ? addBusinessDays(sentAt, PAYMENT_COMPLAINT_BUSINESS_DAYS)
        : addDays(sentAt, BANKING_COMPLAINT_DAYS);
    case "DUPLICATE_CHARGE":
      return addDays(sentAt, MERCHANT_WAIT_DAYS);
    case "CANCELLATION":
      return null;
  }
}

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const DIRECT_DEBIT = /\bsdd\b|\brid\b|addebito\s+(diretto|sepa|sdd)|direct debit|\bmandato\b/;

/** "ADDEBITO DIRETTO SDD ENEL ENERGIA": a SEPA direct debit, refundable for 8 weeks. */
export function looksLikeDirectDebit(description: string) {
  return DIRECT_DEBIT.test(fold(description));
}

const BANK_PREFIX =
  /^(?:pagamento(?:\s+(?:pos|carta|online|contactless))?|addebito(?:\s+(?:diretto|sepa|sdd|rid))*|sdd|rid|pos|bonifico(?:\s+a\s+favore\s+di)?)\b[\s:.-]*/i;
const TRAILING_DATE = /\s+(?:del\s+)?\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b.*$/i;

/**
 * A readable name for letters and lists from how the bank writes the charge:
 * "PAGAMENTO POS NETFLIX.COM 12/09" → "Netflix.com".
 */
export function merchantName(description: string) {
  const original = description.replace(/\s+/g, " ").trim();
  let name = original;
  for (let previous = ""; previous !== name;) {
    previous = name;
    name = name.replace(BANK_PREFIX, "");
  }
  name = name.replace(TRAILING_DATE, "").trim();
  if (!name) return original.slice(0, 80);
  // ALL CAPS (has letters, none lowercase): "ENEL ENERGIA" → "Enel Energia".
  if (name === name.toUpperCase() && name !== name.toLowerCase()) {
    name = name
      .toLowerCase()
      .replace(/(^|\s)(\S)/g, (_, space: string, first: string) => space + first.toUpperCase());
  }
  return name.slice(0, 80);
}

/** What to do about a charge the user contests: a first guess they can change. */
export function suggestedKind(description: string, category: string | null): ClaimKind {
  if (fold(category ?? "") === "commissioni bancarie") return "BANK_COMPLAINT";
  if (looksLikeDirectDebit(description)) return "DIRECT_DEBIT_REFUND";
  if (looksLikeBankFee(description, category)) return "BANK_COMPLAINT";
  return "DUPLICATE_CHARGE";
}

/** Where a claim comes from in "Soldi ritrovati": one claim per finding. */
export type FindingRef =
  | { type: "duplicate"; transactionId: string }
  | { type: "subscription"; recurringKey: string }
  | { type: "fees" }
  | { type: "after"; transactionId: string };

export const findingKey = {
  duplicate: (transactionId: string) => `dup:${transactionId}`,
  subscription: (recurringKey: string) => `sub:${recurringKey}`,
  fees: "fees",
  after: (transactionId: string) => `after:${transactionId}`,
};

export function parseFindingKey(key: string): FindingRef | null {
  if (key === "fees") return { type: "fees" };
  const colon = key.indexOf(":");
  const value = colon > 0 ? key.slice(colon + 1) : "";
  if (!value) return null;
  switch (key.slice(0, colon)) {
    case "dup":
      return { type: "duplicate", transactionId: value };
    case "sub":
      return { type: "subscription", recurringKey: value };
    case "after":
      return { type: "after", transactionId: value };
    default:
      return null;
  }
}

export type CancellationLike = {
  id: string;
  kind: ClaimKind;
  status: ClaimStatus;
  findingKey: string | null;
  counterparty: string;
  effectiveFrom: string | null;
  /** The linked charge's description: the service's name as the bank writes it. */
  chargeDescription: string | null;
};

/** The service a cancellation is about, normalized like recurring charges ("netflix com"). */
export function cancelledService(
  claim: Pick<CancellationLike, "findingKey" | "counterparty" | "chargeDescription">,
) {
  const ref = claim.findingKey ? parseFindingKey(claim.findingKey) : null;
  if (ref?.type === "subscription") {
    // Recurring keys are "EXPENSE|<normalized description>".
    return ref.recurringKey.slice(ref.recurringKey.indexOf("|") + 1);
  }
  return normalizeDescription(claim.chargeDescription ?? claim.counterparty);
}

export type ChargeTx = { id: string; date: string; description: string; amount: number };

export type ChargeAfterCancellation = {
  claimId: string;
  counterparty: string;
  effectiveFrom: string;
  transactionId: string;
  date: string;
  description: string;
  amount: number;
  refundBy: string;
};

/**
 * Charges of a cancelled service from the day it should have stopped, not contested yet: money
 * to ask back from the bank, as a direct debit refund within 8 weeks.
 */
export function chargesAfterCancellation(
  claims: CancellationLike[],
  expenses: ChargeTx[],
  contested: Set<string>,
): ChargeAfterCancellation[] {
  const found: ChargeAfterCancellation[] = [];
  for (const claim of claims) {
    if (claim.kind !== "CANCELLATION" || !claim.effectiveFrom) continue;
    // A refused cancellation (LOST) means the charges go on legitimately.
    if (!["SENT", "WON", "PARTIAL"].includes(claim.status)) continue;
    const service = cancelledService(claim);
    if (!service) continue;
    for (const tx of expenses) {
      if (tx.date < claim.effectiveFrom || contested.has(tx.id)) continue;
      if (normalizeDescription(tx.description) !== service) continue;
      found.push({
        claimId: claim.id,
        counterparty: claim.counterparty,
        effectiveFrom: claim.effectiveFrom,
        transactionId: tx.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        refundBy: refundDeadline(tx.date),
      });
    }
  }
  return found.sort((a, b) => b.date.localeCompare(a.date));
}

const longDate = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "2 marzo 2026". */
export const formatClaimDate = (iso: string) => longDate.format(new Date(`${iso}T00:00:00Z`));

export type StepTone = "urgent" | "todo" | "waiting" | "done" | "closed";

export type NextStep = {
  tone: StepTone;
  text: string;
  /** The claim to open next when this one hits a wall (e.g. the merchant never answered). */
  escalate?: ClaimKind;
};

export type ClaimForStep = {
  kind: ClaimKind;
  status: ClaimStatus;
  deadline: string | null;
  effectiveFrom: string | null;
};

const DRAFT_STEPS: Record<ClaimKind, string> = {
  CANCELLATION:
    "Completa i dati tra parentesi quadre e invia la disdetta, meglio via PEC o dall'area clienti. Se ti sei abbonato online, il sito deve avere anche un pulsante per recedere.",
  DIRECT_DEBIT_REFUND:
    "Completa i dati tra parentesi quadre e invia la richiesta alla tua banca: entro 8 settimane dall'addebito il rimborso non richiede motivazioni.",
  BANK_COMPLAINT:
    "Completa i dati tra parentesi quadre e invia il reclamo all'ufficio reclami della banca, via PEC o raccomandata.",
  DUPLICATE_CHARGE:
    "Completa i dati tra parentesi quadre e invia la richiesta al negozio, con lo scontrino o il numero d'ordine.",
};

/** What the user should do now, from the claim's state and its deadline. */
export function nextStep(claim: ClaimForStep, today: string, chargesAfter = 0): NextStep {
  const { kind, status, deadline } = claim;
  const left = deadline ? daysBetween(today, deadline) : null;
  const by = deadline ? ` entro il ${formatClaimDate(deadline)}` : "";
  const late = left !== null && left < 0;

  if (status === "DRAFT") {
    if (kind !== "DIRECT_DEBIT_REFUND" || left === null) {
      return { tone: "todo", text: DRAFT_STEPS[kind] };
    }
    if (late) {
      return {
        tone: "todo",
        text: `Le 8 settimane per il rimborso sono finite il ${formatClaimDate(deadline!)}. Se non avevi mai autorizzato questo addebito, puoi ancora contestarlo con la banca entro 13 mesi.`,
        escalate: "BANK_COMPLAINT",
      };
    }
    if (left === 0) {
      return {
        tone: "urgent",
        text: "Oggi è l'ultimo giorno per chiedere il rimborso alla banca.",
      };
    }
    return {
      tone: left <= URGENT_DAYS ? "urgent" : "todo",
      text: `Hai tempo fino al ${formatClaimDate(deadline!)} per chiedere il rimborso alla banca: ${left === 1 ? "manca 1 giorno" : `mancano ${left} giorni`}.`,
    };
  }

  if (status === "SENT") {
    switch (kind) {
      case "CANCELLATION":
        if (chargesAfter > 0) {
          return {
            tone: "urgent",
            text:
              chargesAfter === 1
                ? "Ti hanno addebitato il servizio dopo la disdetta: chiedi il rimborso alla banca."
                : `Ti hanno addebitato il servizio ${chargesAfter} volte dopo la disdetta: chiedi il rimborso alla banca.`,
            escalate: "DIRECT_DEBIT_REFUND",
          };
        }
        return {
          tone: "waiting",
          text: claim.effectiveFrom
            ? `Disdetta inviata. Dal ${formatClaimDate(claim.effectiveFrom)} non devono più addebitarti niente: se succede, te lo segnalo io.`
            : "Disdetta inviata. Quando ti confermano la cessazione, segna com'è finita.",
        };
      case "DIRECT_DEBIT_REFUND":
        return late
          ? {
              tone: "urgent",
              text: `La banca doveva rimborsarti, o spiegarti perché no,${by}. Se non l'ha fatto, presenta un reclamo.`,
              escalate: "BANK_COMPLAINT",
            }
          : { tone: "waiting", text: `La banca deve rimborsarti, o spiegarti perché no,${by}.` };
      case "BANK_COMPLAINT":
        return late
          ? {
              tone: "urgent",
              text: `La banca doveva risponderti${by}. Se non l'ha fatto, o la risposta non ti convince, puoi rivolgerti all'Arbitro Bancario Finanziario: costa 20 €, che ti vengono restituiti se hai ragione.`,
            }
          : { tone: "waiting", text: `La banca deve risponderti${by}.` };
      case "DUPLICATE_CHARGE":
        return late
          ? {
              tone: "urgent",
              text: `Il negozio non ha risolto${by}? Contesta l'addebito con la tua banca.`,
              escalate: "BANK_COMPLAINT",
            }
          : { tone: "waiting", text: `Aspetta la risposta del negozio${by}.` };
    }
  }

  switch (status) {
    case "WON":
      return { tone: "done", text: "Pratica vinta: soldi recuperati." };
    case "PARTIAL":
      return { tone: "done", text: "Pratica chiusa: hai recuperato una parte." };
    case "LOST":
      return kind === "BANK_COMPLAINT"
        ? {
            tone: "closed",
            text: "Se non sei d'accordo con la risposta della banca, puoi rivolgerti all'Arbitro Bancario Finanziario entro 12 mesi dal reclamo.",
          }
        : { tone: "closed", text: "Pratica chiusa senza rimborso." };
    default:
      return { tone: "closed", text: "Pratica lasciata perdere." };
  }
}

export type ClaimTotals = {
  /** Money that came back (refunds, reversed charges). */
  recovered: number;
  /** Subscriptions cancelled: what they would have cost in a year. */
  savedPerYear: number;
  won: number;
  open: number;
  urgent: number;
};

export function summarizeClaims(
  claims: {
    kind: ClaimKind;
    status: ClaimStatus;
    recoveredAmount: number | null;
    urgent: boolean;
  }[],
): ClaimTotals {
  let recovered = 0;
  let savedPerYear = 0;
  let won = 0;
  let open = 0;
  let urgent = 0;
  for (const c of claims) {
    if (c.status === "WON" || c.status === "PARTIAL") {
      won++;
      if (c.kind === "CANCELLATION") savedPerYear += c.recoveredAmount ?? 0;
      else recovered += c.recoveredAmount ?? 0;
    }
    if (isOpenClaim(c.status)) {
      open++;
      if (c.urgent) urgent++;
    }
  }
  return { recovered: cents(recovered), savedPerYear: cents(savedPerYear), won, open, urgent };
}
