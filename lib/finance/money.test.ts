import { describe, expect, it } from "vitest";
import { parseAmount, parseSignedAmount } from "./money";

describe("parseAmount", () => {
  it.each([
    ["12", "12.00"],
    ["12,5", "12.50"],
    ["12,50", "12.50"],
    ["12.5", "12.50"],
    ["1.234,56", "1234.56"],
    ["1.234", "1234.00"],
    ["1.234.567", "1234567.00"],
    ["1234.56", "1234.56"],
    ["€ 30", "30.00"],
    [" 0,99 ", "0.99"],
    ["007", "7.00"],
    ["0", "0.00"],
  ])("parses %j as %s", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(["", "abc", "12,345", "1,2,3", "-5", "12.345.6", "1e5", "999999999999999"])(
    "rejects %j",
    (input) => {
      expect(parseAmount(input)).toBeNull();
    },
  );
});

describe("parseSignedAmount", () => {
  it("keeps the sign for negative values", () => {
    expect(parseSignedAmount("-300")).toBe("-300.00");
    expect(parseSignedAmount("-1.250,40")).toBe("-1250.40");
  });

  it("normalizes -0 to 0", () => {
    expect(parseSignedAmount("-0")).toBe("0.00");
  });

  it("rejects invalid input", () => {
    expect(parseSignedAmount("--5")).toBeNull();
  });
});
