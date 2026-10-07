import type { ClaimKind } from "@prisma/client";
import { formatCurrency } from "@/lib/format";

/*
 * The letters of "Riprenditeli", one per kind of claim. The user completes the parts in square
 * brackets (IBAN, customer number) in their own email: FinTrack never stores bank details. The
 * norms cited are informative: the texts are a template, not legal advice.
 */

export type Letter = { subject: string; body: string };

export type LetterInput = {
  kind: ClaimKind;
  fullName: string;
  /** Who took the money: the merchant, the provider or the bank. */
  counterparty: string;
  amount: number;
  currency?: string;
  today: string;
  /** The contested charge, when there is one. */
  chargeDate?: string | null;
  chargeDescription?: string | null;
  /** CANCELLATION: from when; refunds after a cancellation: when the service should have stopped. */
  effectiveFrom?: string | null;
  /** BANK_COMPLAINT about the account's fees rather than a payment. */
  aboutFees?: boolean;
};

export const NAME_PLACEHOLDER = "[Nome e cognome]";

const longDate = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const date = (iso: string) => longDate.format(new Date(`${iso}T00:00:00Z`));
// Plain spaces: Intl's no-break ones show up as odd characters in some email clients.
const money = (n: number, currency = "EUR") => formatCurrency(n, currency).replace(/[  ]/g, " ");

function closing(name: string, today: string) {
  return ["", "Distinti saluti,", name, date(today)];
}

export function cancellationLetter(input: {
  service: string;
  fullName: string;
  today: string;
  effectiveFrom?: string | null;
}): Letter {
  const name = input.fullName.trim() || NAME_PLACEHOLDER;
  const from = input.effectiveFrom
    ? `dal ${date(input.effectiveFrom)}`
    : "dalla prima scadenza utile";
  return {
    subject: `Disdetta abbonamento ${input.service}`,
    body: [
      "Spettabile servizio clienti,",
      "",
      `con la presente io sottoscritto/a ${name}, titolare dell'abbonamento ${input.service} (email dell'account / numero cliente: [da completare]), comunico la disdetta del contratto con effetto ${from}, e chiedo di non procedere a ulteriori addebiti da quella data. Se il pagamento avviene con addebito diretto SEPA, revoco anche il relativo mandato.`,
      "",
      "Vi chiedo cortesemente di confermare per iscritto la ricezione della disdetta e la data di cessazione del servizio.",
      ...closing(name, input.today),
    ].join("\n"),
  };
}

function directDebitRefundLetter(input: LetterInput, name: string): Letter {
  const charge = input.chargeDate ? date(input.chargeDate) : "[data dell'addebito]";
  return {
    subject: "Richiesta di rimborso di un addebito diretto SEPA",
    body: [
      "Spettabile [nome della banca],",
      "",
      `io sottoscritto/a ${name}, titolare del conto [IBAN], chiedo il rimborso dell'addebito diretto SEPA di ${money(input.amount, input.currency)} del ${charge} a favore di ${input.counterparty}.`,
      ...(input.effectiveFrom
        ? [
            "",
            `Il servizio era stato disdetto con effetto dal ${date(input.effectiveFrom)}: l'addebito non era più dovuto.`,
          ]
        : []),
      "",
      "La richiesta arriva entro 8 settimane dalla data dell'addebito, come previsto dagli artt. 13 e 14 del d.lgs. 11/2010 e dalle regole dello schema SEPA Core. Vi chiedo quindi di riaccreditare l'importo entro 10 giornate operative dalla ricezione di questa richiesta, o di comunicarmi per iscritto i motivi di un eventuale rifiuto.",
      ...closing(name, input.today),
    ].join("\n"),
  };
}

function bankComplaintLetter(input: LetterInput, name: string): Letter {
  const amount = money(input.amount, input.currency);
  const charge = input.chargeDate
    ? `l'addebito di ${amount} del ${date(input.chargeDate)}${input.chargeDescription ? ` («${input.chargeDescription}»)` : ""}`
    : null;
  const subject = input.aboutFees
    ? "Reclamo: commissioni addebitate sul conto"
    : `Reclamo: addebito di ${amount}${input.chargeDate ? ` del ${date(input.chargeDate)}` : ""}`;
  const what = input.aboutFees
    ? (charge ??
      `le commissioni addebitate sul mio conto negli ultimi dodici mesi (circa ${amount})`)
    : (charge ?? `un addebito di ${amount} a favore di ${input.counterparty}`);
  const request = input.aboutFees
    ? "Vi chiedo di indicarmi su quale clausola del contratto si basano questi addebiti e di rimborsare quelli non dovuti. Se derivano da una modifica delle condizioni, vi chiedo copia della comunicazione che avreste dovuto inviarmi con almeno due mesi di preavviso, come previsto dall'art. 118 del Testo unico bancario."
    : "L'addebito non è dovuto: [spiega in breve perché, per esempio «è stato addebitato due volte» o «non l'ho mai autorizzato»]. Vi chiedo di verificarlo e di riaccreditare l'importo, come previsto dagli artt. 9 e 11 del d.lgs. 11/2010 per le operazioni non autorizzate o eseguite in modo inesatto.";
  return {
    subject,
    body: [
      "Spettabile Ufficio Reclami di [nome della banca],",
      "",
      `io sottoscritto/a ${name}, titolare del conto [IBAN], presento reclamo per ${what}.`,
      "",
      request,
      "",
      "Vi ricordo che i reclami vanno riscontrati nei termini previsti dalla Banca d'Italia (15 giornate operative per i servizi di pagamento, 60 giorni negli altri casi). Se non riceverò risposta, o se la risposta non sarà soddisfacente, potrò rivolgermi all'Arbitro Bancario Finanziario.",
      ...closing(name, input.today),
    ].join("\n"),
  };
}

function duplicateChargeLetter(input: LetterInput, name: string): Letter {
  const charge = input.chargeDate ? date(input.chargeDate) : "[data dell'addebito]";
  return {
    subject: `Addebito non corretto del ${charge}`,
    body: [
      `Spettabile ${input.counterparty},`,
      "",
      `il ${charge} mi è stato addebitato un importo di ${money(input.amount, input.currency)} a vostro favore${input.chargeDescription ? ` («${input.chargeDescription}»)` : ""}, che risulta duplicato o non corretto.`,
      "",
      "Vi chiedo di verificare e di stornare l'importo non dovuto entro 14 giorni, comunicandomi la data del riaccredito.",
      "",
      "Dati utili per la verifica: numero d'ordine o dello scontrino [da completare]; ultime quattro cifre della carta [da completare].",
      ...closing(name, input.today),
    ].join("\n"),
  };
}

/** The letter for a new claim, ready to complete and send. */
export function claimLetter(input: LetterInput): Letter {
  const name = input.fullName.trim() || NAME_PLACEHOLDER;
  switch (input.kind) {
    case "CANCELLATION":
      return cancellationLetter({
        service: input.counterparty,
        fullName: input.fullName,
        today: input.today,
        effectiveFrom: input.effectiveFrom,
      });
    case "DIRECT_DEBIT_REFUND":
      return directDebitRefundLetter(input, name);
    case "BANK_COMPLAINT":
      return bankComplaintLetter(input, name);
    case "DUPLICATE_CHARGE":
      return duplicateChargeLetter(input, name);
  }
}

/** Placeholders still to fill in ("[IBAN]", "[da completare]"…), to remind the user before sending. */
export function missingDetails(body: string) {
  return Array.from(new Set(body.match(/\[[^\]\n]{2,80}\]/g) ?? []));
}
