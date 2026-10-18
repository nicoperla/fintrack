import { describe, expect, it } from "vitest";
import { defaultDeductible, parseReceiptReply, splitReceipt } from "./receipt";

const reply = JSON.stringify({
  readable: true,
  merchant: "Farmacia Centrale",
  date: "2026-10-12",
  total: 31.4,
  payment: "contanti",
  fiscalCode: true,
  pharmacy: true,
  items: [
    { description: "TACHIPIRINA 500MG", amount: 5.9, kind: "farmaco", aic: "012745093" },
    { description: "CEROTTI MEDICATI DM", amount: 4.5, kind: "dispositivo", aic: null },
    { description: "CREMA MANI", amount: 9, kind: "parafarmaco", aic: null },
    { description: "MOMENT ACT", amount: 12, kind: "parafarmaco", aic: "034011060" },
  ],
});

describe("parseReceiptReply", () => {
  it("reads the AI's JSON, even inside a code fence", () => {
    const r = parseReceiptReply("```json\n" + reply + "\n```");
    expect(r).toMatchObject({
      merchant: "Farmacia Centrale",
      payment: "contanti",
      fiscalCode: true,
    });
    expect(r?.items).toHaveLength(4);
  });

  it("trusts a medicine code over the AI's guess", () => {
    expect(parseReceiptReply(reply)?.items[3].kind).toBe("farmaco");
  });

  it("drops what it doesn't understand and refuses non-answers", () => {
    const odd = parseReceiptReply(
      JSON.stringify({
        readable: true,
        date: "12/10/2026",
        payment: "bitcoin",
        items: [{ description: "X", amount: 3, kind: "magia", aic: "123" }],
      }),
    );
    expect(odd).toMatchObject({ date: null, payment: null, fiscalCode: false });
    expect(odd?.items[0]).toMatchObject({ kind: "parafarmaco", aic: null });
    expect(parseReceiptReply("Non è uno scontrino")).toBeNull();
    expect(parseReceiptReply('{"items": "tanti"}')).toBeNull();
  });
});

describe("splitReceipt", () => {
  it("puts medicines, devices and tickets in the 730 part by default", () => {
    const r = parseReceiptReply(reply)!;
    const deductible = defaultDeductible(r.items);
    expect(Array.from(deductible)).toEqual([0, 1, 3]);
    expect(splitReceipt(r.items, deductible)).toEqual({
      health: { count: 3, amount: 22.4 },
      other: { count: 1, amount: 9 },
      total: 31.4,
    });
  });

  it("follows the user's choice", () => {
    const r = parseReceiptReply(reply)!;
    expect(splitReceipt(r.items, new Set([0])).health.amount).toBe(5.9);
    expect(splitReceipt(r.items, new Set()).other.amount).toBe(31.4);
  });
});
