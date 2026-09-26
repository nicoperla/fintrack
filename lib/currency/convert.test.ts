import { describe, expect, it } from "vitest";
import { convertAmount, CurrencyError, round2 } from "./convert";

const rates = { USD: 1.1, GBP: 0.85, JPY: 160 };

describe("convertAmount", () => {
  it("returns the amount untouched for the same currency", () => {
    expect(convertAmount(12.345, "USD", "USD", {})).toBe(12.345);
  });
  it("converts from EUR", () => {
    expect(convertAmount(100, "EUR", "USD", rates)).toBe(110);
  });
  it("converts to EUR", () => {
    expect(convertAmount(110, "USD", "EUR", rates)).toBe(100);
  });
  it("converts between two foreign currencies through EUR", () => {
    // 100 GBP = 117.647… EUR = 129.41 USD
    expect(convertAmount(100, "GBP", "USD", rates)).toBe(129.41);
  });
  it("rounds to cents", () => {
    expect(convertAmount(1000, "JPY", "EUR", rates)).toBe(6.25);
    expect(convertAmount(1, "USD", "EUR", rates)).toBe(0.91);
  });
  it("fails loudly when a rate is missing", () => {
    expect(() => convertAmount(10, "CHF", "EUR", rates)).toThrow(CurrencyError);
  });
});

describe("round2", () => {
  it("rounds halves up", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
  });
});
