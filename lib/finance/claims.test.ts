import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  answerDeadline,
  cancelledService,
  chargesAfterCancellation,
  draftDeadline,
  easterSunday,
  formatClaimDate,
  isBusinessDay,
  italianHolidays,
  looksLikeDirectDebit,
  merchantName,
  nextStep,
  parseFindingKey,
  refundDeadline,
  suggestedKind,
  summarizeClaims,
  type CancellationLike,
  type ClaimForStep,
} from "./claims";

describe("deadlines", () => {
  it("gives 8 weeks to ask for a direct debit refund", () => {
    expect(refundDeadline("2026-01-05")).toBe("2026-03-02");
    expect(refundDeadline("2028-01-05")).toBe("2028-03-01");
  });

  it("only sets a deadline to act on direct debit refunds", () => {
    expect(draftDeadline("DIRECT_DEBIT_REFUND", "2026-09-01")).toBe("2026-10-27");
    expect(draftDeadline("DIRECT_DEBIT_REFUND", null)).toBeNull();
    expect(draftDeadline("CANCELLATION", "2026-09-01")).toBeNull();
  });

  it("counts the time the other side has to answer", () => {
    expect(answerDeadline("DIRECT_DEBIT_REFUND", "2026-10-06", false)).toBe("2026-10-20");
    expect(answerDeadline("BANK_COMPLAINT", "2026-10-06", true)).toBe("2026-10-27");
    expect(answerDeadline("BANK_COMPLAINT", "2026-10-06", false)).toBe("2026-12-05");
    expect(answerDeadline("DUPLICATE_CHARGE", "2026-10-06", true)).toBe("2026-10-20");
    expect(answerDeadline("CANCELLATION", "2026-10-06", false)).toBeNull();
  });
});

describe("Italian business days", () => {
  it("finds Easter", () => {
    expect(easterSunday(2024)).toBe("2024-03-31");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });

  it("knows Easter Monday and San Francesco from 2026", () => {
    expect(italianHolidays(2026).has("2026-04-06")).toBe(true);
    expect(italianHolidays(2027).has("2027-03-29")).toBe(true);
    expect(italianHolidays(2027).has("2027-10-04")).toBe(true);
    expect(italianHolidays(2025).has("2025-10-04")).toBe(false);
  });

  it("skips weekends, holidays and the banks' half days", () => {
    expect(isBusinessDay("2027-10-04")).toBe(false); // San Francesco, a Monday
    expect(isBusinessDay("2027-10-05")).toBe(true);
    expect(isBusinessDay("2026-10-10")).toBe(false); // Saturday
    expect(isBusinessDay("2026-12-24")).toBe(false);
  });

  it("counts 15 business days across Christmas", () => {
    expect(addBusinessDays("2026-12-21", 15)).toBe("2027-01-18");
  });
});

describe("recognizing charges", () => {
  it("spots SEPA direct debits in bank descriptions", () => {
    expect(looksLikeDirectDebit("ADDEBITO DIRETTO SDD ENEL ENERGIA")).toBe(true);
    expect(looksLikeDirectDebit("RID FASTWEB")).toBe(true);
    expect(looksLikeDirectDebit("Addebito SEPA Iren")).toBe(true);
    expect(looksLikeDirectDebit("PAGAMENTO POS NETFLIX")).toBe(false);
    expect(looksLikeDirectDebit("Hotel Madrid")).toBe(false);
  });

  it("turns bank descriptions into names fit for a letter", () => {
    expect(merchantName("PAGAMENTO POS NETFLIX.COM 12/09")).toBe("Netflix.com");
    expect(merchantName("ADDEBITO DIRETTO SDD ENEL ENERGIA")).toBe("Enel Energia");
    expect(merchantName("SDD FITLIFE PALESTRA 02/10")).toBe("Fitlife Palestra");
    expect(merchantName("FitLife Palestra")).toBe("FitLife Palestra");
    expect(merchantName("POSTE ITALIANE")).toBe("Poste Italiane");
    expect(merchantName("SDD")).toBe("SDD");
  });

  it("suggests what kind of claim fits a charge", () => {
    expect(suggestedKind("SDD TIM CANONE MENSILE", null)).toBe("DIRECT_DEBIT_REFUND");
    expect(suggestedKind("Canone conto corrente", null)).toBe("BANK_COMPLAINT");
    expect(suggestedKind("Spese trimestrali", "Commissioni bancarie")).toBe("BANK_COMPLAINT");
    expect(suggestedKind("Zalando SE", "Abbigliamento")).toBe("DUPLICATE_CHARGE");
  });
});

describe("parseFindingKey", () => {
  it("reads the findings claims start from", () => {
    expect(parseFindingKey("dup:tx1")).toEqual({ type: "duplicate", transactionId: "tx1" });
    expect(parseFindingKey("sub:EXPENSE|netflix com")).toEqual({
      type: "subscription",
      recurringKey: "EXPENSE|netflix com",
    });
    expect(parseFindingKey("fees")).toEqual({ type: "fees" });
    expect(parseFindingKey("after:tx2")).toEqual({ type: "after", transactionId: "tx2" });
  });

  it("rejects anything else", () => {
    expect(parseFindingKey("dup:")).toBeNull();
    expect(parseFindingKey("price:x:2026-10-01")).toBeNull();
    expect(parseFindingKey("")).toBeNull();
  });
});

const cancellation = (over: Partial<CancellationLike> = {}): CancellationLike => ({
  id: "c1",
  kind: "CANCELLATION",
  status: "SENT",
  findingKey: "sub:EXPENSE|fitlife palestra",
  counterparty: "FitLife Palestra",
  effectiveFrom: "2026-10-01",
  chargeDescription: null,
  ...over,
});

describe("chargesAfterCancellation", () => {
  it("names the service the way the bank writes it", () => {
    expect(cancelledService(cancellation())).toBe("fitlife palestra");
    expect(
      cancelledService(
        cancellation({ findingKey: null, chargeDescription: "SDD FITLIFE PALESTRA 02/10" }),
      ),
    ).toBe("fitlife palestra");
    expect(cancelledService(cancellation({ findingKey: null, counterparty: "Netflix" }))).toBe(
      "netflix",
    );
  });

  const expenses = [
    { id: "t1", date: "2026-09-02", description: "FitLife Palestra", amount: 45 },
    { id: "t2", date: "2026-10-02", description: "FitLife Palestra", amount: 45 },
    { id: "t3", date: "2026-10-03", description: "Esselunga", amount: 30 },
    { id: "t4", date: "2026-10-05", description: "FITLIFE PALESTRA", amount: 45 },
  ];

  it("finds the charges after the effective date that nobody contested yet", () => {
    expect(chargesAfterCancellation([cancellation()], expenses, new Set(["t4"]))).toEqual([
      {
        claimId: "c1",
        counterparty: "FitLife Palestra",
        effectiveFrom: "2026-10-01",
        transactionId: "t2",
        date: "2026-10-02",
        description: "FitLife Palestra",
        amount: 45,
        refundBy: "2026-11-27",
      },
    ]);
  });

  it("ignores cancellations not sent yet or refused", () => {
    expect(
      chargesAfterCancellation([cancellation({ status: "DRAFT" })], expenses, new Set()),
    ).toEqual([]);
    expect(
      chargesAfterCancellation([cancellation({ status: "LOST" })], expenses, new Set()),
    ).toEqual([]);
    expect(
      chargesAfterCancellation([cancellation({ effectiveFrom: null })], expenses, new Set()),
    ).toEqual([]);
  });
});

const claim = (over: Partial<ClaimForStep>): ClaimForStep => ({
  kind: "DIRECT_DEBIT_REFUND",
  status: "DRAFT",
  deadline: null,
  effectiveFrom: null,
  ...over,
});

describe("nextStep", () => {
  const today = "2026-10-06";

  it("counts down the 8 weeks of a direct debit refund", () => {
    const soon = nextStep(claim({ deadline: "2026-10-10" }), today);
    expect(soon.tone).toBe("urgent");
    expect(soon.text).toContain("mancano 4 giorni");
    expect(nextStep(claim({ deadline: "2026-11-27" }), today).tone).toBe("todo");
    expect(nextStep(claim({ deadline: today }), today).text).toContain("Oggi è l'ultimo giorno");
  });

  it("points to the 13 months for charges never authorized once the 8 weeks are over", () => {
    const late = nextStep(claim({ deadline: "2026-10-01" }), today);
    expect(late.text).toContain("13 mesi");
    expect(late.escalate).toBe("BANK_COMPLAINT");
  });

  it("suggests the ABF when the bank doesn't answer a complaint in time", () => {
    const sent = { kind: "BANK_COMPLAINT", status: "SENT" } as const;
    const late = nextStep(claim({ ...sent, deadline: "2026-10-01" }), today);
    expect(late.tone).toBe("urgent");
    expect(late.text).toContain("Arbitro Bancario Finanziario");
    const waiting = nextStep(claim({ ...sent, deadline: "2026-10-27" }), today);
    expect(waiting).toEqual({
      tone: "waiting",
      text: "La banca deve risponderti entro il 27 ottobre 2026.",
    });
  });

  it("flags charges after a cancellation", () => {
    const cancelled = claim({ kind: "CANCELLATION", status: "SENT", effectiveFrom: "2026-10-01" });
    expect(nextStep(cancelled, today, 1)).toMatchObject({
      tone: "urgent",
      escalate: "DIRECT_DEBIT_REFUND",
    });
    expect(nextStep(cancelled, today).text).toContain("Dal 1 ottobre 2026");
  });

  it("sends the merchant's silence to the bank", () => {
    const late = nextStep(
      claim({ kind: "DUPLICATE_CHARGE", status: "SENT", deadline: "2026-10-05" }),
      today,
    );
    expect(late).toMatchObject({ tone: "urgent", escalate: "BANK_COMPLAINT" });
  });

  it("closes the story", () => {
    expect(nextStep(claim({ status: "WON" }), today).tone).toBe("done");
    expect(nextStep(claim({ kind: "BANK_COMPLAINT", status: "LOST" }), today).text).toContain(
      "12 mesi",
    );
  });
});

describe("summarizeClaims", () => {
  it("keeps money back apart from subscriptions cancelled", () => {
    expect(
      summarizeClaims([
        { kind: "DUPLICATE_CHARGE", status: "WON", recoveredAmount: 49, urgent: false },
        { kind: "CANCELLATION", status: "WON", recoveredAmount: 120, urgent: false },
        { kind: "DIRECT_DEBIT_REFUND", status: "PARTIAL", recoveredAmount: 10.5, urgent: false },
        { kind: "BANK_COMPLAINT", status: "LOST", recoveredAmount: null, urgent: false },
        { kind: "DIRECT_DEBIT_REFUND", status: "DRAFT", recoveredAmount: null, urgent: true },
        { kind: "CANCELLATION", status: "SENT", recoveredAmount: null, urgent: false },
      ]),
    ).toEqual({ recovered: 59.5, savedPerYear: 120, won: 3, open: 2, urgent: 1 });
  });
});

describe("formatClaimDate", () => {
  it("writes dates the Italian way", () => {
    expect(formatClaimDate("2026-03-02")).toBe("2 marzo 2026");
  });
});
