import { describe, expect, it } from "vitest";
import { CLAIM_KINDS } from "@/lib/finance/claims";
import {
  NAME_PLACEHOLDER,
  cancellationLetter,
  claimLetter,
  missingDetails,
  type LetterInput,
} from "./letters";

const base: LetterInput = {
  kind: "DIRECT_DEBIT_REFUND",
  fullName: "Anna Rossi",
  counterparty: "FitLife Palestra",
  amount: 49,
  today: "2026-10-06",
  chargeDate: "2026-10-02",
  chargeDescription: "SDD FITLIFE PALESTRA",
};

describe("cancellationLetter", () => {
  it("names the service and the sender", () => {
    const letter = cancellationLetter({
      service: "Netflix",
      fullName: "Anna Rossi",
      today: "2026-10-01",
    });
    expect(letter.subject).toBe("Disdetta abbonamento Netflix");
    expect(letter.body).toContain("io sottoscritto/a Anna Rossi");
    expect(letter.body).toContain("dalla prima scadenza utile");
    expect(letter.body).toContain("1 ottobre 2026");
  });

  it("states the effective date when the user chose one", () => {
    const letter = cancellationLetter({
      service: "Netflix",
      fullName: "Anna Rossi",
      today: "2026-10-01",
      effectiveFrom: "2026-11-01",
    });
    expect(letter.body).toContain("con effetto dal 1 novembre 2026");
  });
});

describe("claimLetter", () => {
  it("writes a complete letter for every kind", () => {
    for (const kind of CLAIM_KINDS) {
      const { subject, body } = claimLetter({ ...base, kind });
      expect(subject.length).toBeGreaterThan(5);
      expect(body).toContain("Anna Rossi");
      expect(body).toContain("6 ottobre 2026");
      expect(`${subject}\n${body}`).not.toMatch(/\b(undefined|NaN|null)\b/);
    }
  });

  it("asks the bank for a direct debit refund within the 8 weeks", () => {
    const { subject, body } = claimLetter(base);
    expect(subject).toBe("Richiesta di rimborso di un addebito diretto SEPA");
    expect(body).toContain("addebito diretto SEPA di 49,00 € del 2 ottobre 2026");
    expect(body).toContain("artt. 13 e 14 del d.lgs. 11/2010");
    expect(missingDetails(body)).toEqual(["[nome della banca]", "[IBAN]"]);
  });

  it("recalls the cancellation when the charge came after it", () => {
    const { body } = claimLetter({ ...base, effectiveFrom: "2026-10-01" });
    expect(body).toContain("disdetto con effetto dal 1 ottobre 2026");
  });

  it("asks for the contract clause behind the fees", () => {
    const { subject, body } = claimLetter({
      ...base,
      kind: "BANK_COMPLAINT",
      aboutFees: true,
      chargeDate: null,
      amount: 94.8,
    });
    expect(subject).toBe("Reclamo: commissioni addebitate sul conto");
    expect(body).toContain("negli ultimi dodici mesi (circa 94,80 €)");
    expect(body).toContain("art. 118 del Testo unico bancario");
    expect(body).toContain("Arbitro Bancario Finanziario");
  });

  it("contests a payment as not authorized or wrong", () => {
    const { body } = claimLetter({ ...base, kind: "BANK_COMPLAINT" });
    expect(body).toContain("l'addebito di 49,00 € del 2 ottobre 2026 («SDD FITLIFE PALESTRA»)");
    expect(body).toContain("artt. 9 e 11 del d.lgs. 11/2010");
  });

  it("writes to the merchant first about a duplicate charge", () => {
    const { subject, body } = claimLetter({
      ...base,
      kind: "DUPLICATE_CHARGE",
      counterparty: "Zalando",
      chargeDate: null,
    });
    expect(subject).toBe("Addebito non corretto del [data dell'addebito]");
    expect(body.startsWith("Spettabile Zalando,")).toBe(true);
  });

  it("leaves a placeholder when the name is unknown", () => {
    const { body } = claimLetter({ ...base, fullName: "  " });
    expect(body).toContain(`io sottoscritto/a ${NAME_PLACEHOLDER}`);
  });
});
