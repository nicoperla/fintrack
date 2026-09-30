import { describe, expect, it } from "vitest";
import { checkAffordability, type AffordInput } from "./affordability";

const money = (n: number) => `${Math.round(n)} €`;

// 30 days: 600 today, slowly spent down, salary of 1500 on day 10.
const points = Array.from({ length: 31 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10),
  balance: 600 - i * 20 + (i >= 10 ? 1500 : 0),
}));

const base: AffordInput = {
  amount: 100,
  monthly: false,
  points,
  events: [{ date: "2026-10-11", name: "Stipendio", amount: 1500 }],
  dailySpend: 20,
  savingsBalance: 2000,
  monthlySaved: 300,
  goals: [{ name: "Giappone", remaining: 3000 }],
  budget: null,
  workRate: { hourly: 12, dayHours: 8 },
};

describe("checkAffordability", () => {
  it("says yes to a small purchase", () => {
    const result = checkAffordability(base, money)!;
    expect(result.verdict).toBe("yes");
    expect(result.reasons.some((r) => r.text.includes("1 giornata di lavoro"))).toBe(true);
    expect(result.reasons.some((r) => r.text.includes("Giappone"))).toBe(true);
  });

  it("points to the day after the salary when it's tight before", () => {
    const result = checkAffordability({ ...base, amount: 500 }, money)!;
    expect(result.verdict).toBe("savings");
    expect(result.bestDate).toBe("2026-10-11");
    expect(result.reasons.some((r) => r.text.includes("dopo «Stipendio»"))).toBe(true);
  });

  it("says no when neither the accounts nor the savings cover it", () => {
    const result = checkAffordability({ ...base, amount: 900, savingsBalance: 100 }, money)!;
    expect(result.verdict).toBe("no");
  });

  it("rejects a monthly cost larger than what you save", () => {
    const result = checkAffordability({ ...base, amount: 350, monthly: true }, money)!;
    expect(result.verdict).toBe("no");
    expect(result.reasons.some((r) => r.text.includes("All'anno sono 4200 €"))).toBe(true);
  });

  it("warns about the category budget", () => {
    const result = checkAffordability(
      { ...base, budget: { name: "Shopping", amount: 150, spent: 120 } },
      money,
    )!;
    expect(
      result.reasons.some((r) => r.text.includes("Sforeresti il budget «Shopping» di 70 €")),
    ).toBe(true);
  });

  it("ignores empty amounts", () => {
    expect(checkAffordability({ ...base, amount: 0 }, money)).toBeNull();
  });
});
