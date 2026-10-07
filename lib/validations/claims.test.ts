import { describe, expect, it } from "vitest";
import { markSentSchema, openClaimSchema, outcomeSchema } from "./claims";

const errorsOf = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.success ? [] : result.error!.issues.map((i) => i.path.join("."));

describe("openClaimSchema", () => {
  it("accepts an Italian amount and empty optional fields", () => {
    const result = openClaimSchema.safeParse({
      kind: "CANCELLATION",
      counterparty: "  Netflix ",
      amount: "1.234,50",
      chargeDate: "",
      effectiveFrom: "2026-11-01",
    });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      counterparty: "Netflix",
      amount: "1234.50",
      chargeDate: null,
      effectiveFrom: "2026-11-01",
      findingKey: null,
      transactionId: null,
    });
  });

  it("needs the charge date of a direct debit opened by hand", () => {
    const input = { kind: "DIRECT_DEBIT_REFUND", counterparty: "Enel", amount: "80" };
    expect(errorsOf(openClaimSchema.safeParse(input))).toEqual(["chargeDate"]);
    expect(openClaimSchema.safeParse({ ...input, transactionId: "tx1" }).success).toBe(true);
    expect(openClaimSchema.safeParse({ ...input, chargeDate: "2026-09-30" }).success).toBe(true);
  });

  it("rejects charges in the future, zero amounts and unknown kinds", () => {
    const base = { kind: "DUPLICATE_CHARGE", counterparty: "Zalando", amount: "59,90" };
    expect(errorsOf(openClaimSchema.safeParse({ ...base, chargeDate: "2099-01-01" }))).toEqual([
      "chargeDate",
    ]);
    expect(errorsOf(openClaimSchema.safeParse({ ...base, amount: "0" }))).toEqual(["amount"]);
    expect(errorsOf(openClaimSchema.safeParse({ ...base, kind: "LAWSUIT" }))).toEqual(["kind"]);
  });
});

describe("markSentSchema", () => {
  it("wants a channel and a sending date that isn't in the future", () => {
    expect(markSentSchema.safeParse({ channel: "pec", sentAt: "2026-10-01" }).success).toBe(true);
    expect(errorsOf(markSentSchema.safeParse({ channel: "fax", sentAt: "2099-10-01" }))).toEqual([
      "channel",
      "sentAt",
    ]);
  });
});

describe("outcomeSchema", () => {
  it("asks how much came back when the claim was won", () => {
    expect(errorsOf(outcomeSchema.safeParse({ status: "WON", recoveredAmount: "" }))).toEqual([
      "recoveredAmount",
    ]);
    expect(outcomeSchema.safeParse({ status: "PARTIAL", recoveredAmount: "20" }).data).toEqual({
      status: "PARTIAL",
      recoveredAmount: "20.00",
      notes: null,
    });
  });

  it("drops the amount of a lost claim", () => {
    expect(
      outcomeSchema.safeParse({ status: "LOST", recoveredAmount: "45", notes: " Mai risposto " })
        .data,
    ).toEqual({ status: "LOST", recoveredAmount: null, notes: "Mai risposto" });
  });
});
