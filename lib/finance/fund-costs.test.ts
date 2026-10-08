import { describe, expect, it } from "vitest";
import {
  advisorQuestions,
  compareWithCategory,
  FUND_CATEGORY_INFO,
  projectCosts,
  yearlyCost,
} from "./fund-costs";

const bankFund = { entry: 0, exit: 0, ongoing: 1.85, transaction: 0.15, performance: 0 };
const none = { entry: 0, exit: 0, ongoing: 0, transaction: 0, performance: 0 };

describe("what the costs take away", () => {
  it("turns 2% a year on 50.000 € into tens of thousands of euros", () => {
    const p = projectCosts({ value: 50_000, monthly: 0, grossReturn: 3, costs: bankFund });
    expect(p.byHorizon.map((h) => [h.years, h.cost])).toEqual([
      [10, 12239.03],
      [20, 30033.68],
      [30, 55458.67],
    ]);
    expect(p.byHorizon[1].share).toBeCloseTo(0.33, 2);
    expect(p.gross.slice(0, 2)).toEqual([50_000, 51520.8]);
    expect(p.net).toHaveLength(31);
  });

  it("charges the entry cost on every payment and the exit cost at the end", () => {
    const p = projectCosts({
      value: 10_000,
      monthly: 200,
      grossReturn: 4,
      costs: { entry: 2, exit: 1, ongoing: 1.5, transaction: 0, performance: 0 },
    });
    expect(p.net[0]).toBe(9900);
    expect(p.byHorizon[0]).toMatchObject({ gross: 44358.29, net: 39118.2, cost: 5240.09 });
  });

  it("takes nothing away without costs", () => {
    const p = projectCosts({ value: 1000, monthly: 0, grossReturn: 0, costs: none });
    expect(p.byHorizon.every((h) => h.cost === 0 && h.gross === 1000)).toBe(true);
  });
});

describe("against the category", () => {
  it("adds up the yearly costs and compares them with ESMA's average", () => {
    expect(yearlyCost(bankFund)).toBe(2);
    expect(compareWithCategory(bankFund, "equity")).toEqual({
      reference: 1.38,
      yearly: 2,
      verdict: "above",
    });
    expect(
      compareWithCategory({ ...bankFund, ongoing: 1.3, transaction: 0.1 }, "equity")?.verdict,
    ).toBe("inline");
    expect(compareWithCategory({ ...none, ongoing: 0.12 }, "etf-equity")?.verdict).toBe("below");
  });

  it("has no reference for insurance products and pension funds", () => {
    expect(compareWithCategory(bankFund, "other")).toBeNull();
    expect(FUND_CATEGORY_INFO.other.ongoing).toBeNull();
  });
});

describe("questions for the advisor", () => {
  it("asks about each cost there is, and why it's above the average", () => {
    const questions = advisorQuestions(
      { entry: 2, exit: 1, ongoing: 1.85, transaction: 0.15, performance: 0.2 },
      "equity",
    );
    expect(questions).toHaveLength(8);
    expect(questions).toContain(
      "Perché costa più della media dei fondi azionari venduti nell'Unione europea?",
    );
    expect(questions.some((q) => q.includes("commissione di performance"))).toBe(true);
  });

  it("keeps to the basic ones for a cheap product, and never says what to do", () => {
    const questions = advisorQuestions({ ...none, ongoing: 0.2 }, "etf-equity");
    expect(questions).toHaveLength(4);
    for (const q of questions) expect(q).toMatch(/\?$/);
    // Who sold it is a fair question; telling to sell, buy or switch is not.
    expect(questions.join(" ")).not.toMatch(/\b(vendi|vendere|compra|comprare|passa a)\b/i);
  });
});
