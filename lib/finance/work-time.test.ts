import { describe, expect, it } from "vitest";
import { formatWorkTime, workRate } from "./work-time";

// 1.733,33 € net for 40 hours a week → exactly 10 € an hour, 8-hour days.
const rate = workRate(1733.33, 40)!;

describe("workRate", () => {
  it("spreads the monthly income over the monthly working hours", () => {
    expect(rate.hourly).toBeCloseTo(10, 2);
    expect(rate.dayHours).toBe(8);
  });

  it("needs a positive income and hours", () => {
    expect(workRate(0, 40)).toBeNull();
    expect(workRate(2000, 0)).toBeNull();
  });
});

describe("formatWorkTime", () => {
  it.each([
    [0.05, "meno di un minuto"],
    [1.5, "9 min"],
    [4.5, "27 min"],
    [10, "1 h"],
    [22.5, "2 h 15 min"],
    [79, "7 h 55 min"],
    [80, "1 giornata"],
    [249, "3 giornate e 1 h"],
    [750, "9 giornate e 3 h"],
    [3470, "circa 2 mesi"],
    [4300, "circa 2,5 mesi"],
  ])("%d € → %s", (amount, expected) => {
    expect(formatWorkTime(amount, rate)).toBe(expected);
  });

  it("ignores the sign", () => {
    expect(formatWorkTime(-22.5, rate)).toBe("2 h 15 min");
  });
});
