import { describe, expect, it } from "vitest";
import { monthsToReach, projectBalance } from "./projection";
import { simulatePayoff, type DebtInput } from "./debts";

describe("projectBalance", () => {
  it("adds contributions without interest", () => {
    expect(projectBalance(1000, 200, 0, 3)).toEqual([1000, 1200, 1400, 1600]);
  });

  it("compounds monthly", () => {
    const values = projectBalance(10000, 0, 12, 12);
    expect(values[12]).toBeCloseTo(11268.25, 1); // (1 + 1%)^12
  });
});

describe("monthsToReach", () => {
  it("counts the months to a target", () => {
    expect(monthsToReach(1000, 0, 100, 0)).toBe(10);
    expect(monthsToReach(500, 600, 0, 0)).toBe(0);
  });

  it("returns null when the target is unreachable", () => {
    expect(monthsToReach(1000, 0, 0, 0)).toBeNull();
  });
});

describe("simulatePayoff", () => {
  it("amortizes a single interest-free debt", () => {
    const result = simulatePayoff(
      [{ id: "a", name: "A", balance: 1000, apr: 0, minPayment: 100 }],
      0,
      "avalanche",
    );
    expect(result).toMatchObject({ feasible: true, months: 10, totalInterest: 0, totalPaid: 1000 });
    expect(result.balances).toHaveLength(11);
    expect(result.payoffs).toEqual([{ id: "a", name: "A", month: 10, interest: 0 }]);
  });

  const debts: DebtInput[] = [
    { id: "car", name: "Prestito auto", balance: 6200, apr: 6.9, minPayment: 190 },
    { id: "revolving", name: "Carta revolving", balance: 1450, apr: 17.9, minPayment: 55 },
    { id: "sofa", name: "Divano", balance: 900, apr: 9.9, minPayment: 60 },
  ];

  it("snowball closes the smallest balance first", () => {
    const result = simulatePayoff(debts, 150, "snowball");
    expect(result.feasible).toBe(true);
    expect(result.payoffs[0].id).toBe("sofa");
  });

  it("avalanche closes the highest rate first and pays less interest", () => {
    const avalanche = simulatePayoff(debts, 150, "avalanche");
    const snowball = simulatePayoff(debts, 150, "snowball");
    expect(avalanche.payoffs[0].id).toBe("revolving");
    expect(avalanche.totalInterest).toBeLessThan(snowball.totalInterest);
    expect(avalanche.months).toBeLessThanOrEqual(snowball.months);
  });

  it("extra payments shorten the plan", () => {
    expect(simulatePayoff(debts, 300, "avalanche").months).toBeLessThan(
      simulatePayoff(debts, 0, "avalanche").months,
    );
  });

  it("flags plans where payments don't cover interest", () => {
    const result = simulatePayoff(
      [{ id: "x", name: "X", balance: 10000, apr: 24, minPayment: 150 }],
      0,
      "avalanche",
    );
    expect(result.feasible).toBe(false);
  });
});
