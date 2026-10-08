import { describe, expect, it } from "vitest";
import {
  annuityPayment,
  baselineProjection,
  emergencyTarget,
  estimateRal,
  irpef,
  jobLoss,
  mortgageRise,
  naspiEstimate,
  naspiNetInMonth,
  netFromRal,
  netOfIrpef,
  project,
  remainingMonths,
  toneFor,
  unexpectedExpense,
  workDeduction,
} from "./crash-test";

describe("NASpI", () => {
  it("pays 75% of the average pay up to the threshold, plus 25% of the rest", () => {
    const n = naspiEstimate({ ral: 28_000, monthsWorked: 60, age: 40 });
    expect(n).toEqual({
      eligible: true,
      averagePay: 2333.33,
      // 1.456,72 × 75% + (2.333,33 − 1.456,72) × 25%
      gross: 1311.69,
      net: 1262.69,
      months: 24,
      fullMonths: 5,
      capped: false,
    });
    expect(naspiEstimate({ ral: 15_000, monthsWorked: 48, age: null }).gross).toBe(937.5);
  });

  it("stops at the 2026 ceiling", () => {
    const n = naspiEstimate({ ral: 60_000, monthsWorked: 48, age: null });
    expect(n.gross).toBe(1584.7);
    expect(n.capped).toBe(true);
  });

  it("lasts half the time worked in the last four years, at most two years", () => {
    expect(naspiEstimate({ ral: 15_000, monthsWorked: 9, age: null }).months).toBe(4.5);
    expect(naspiEstimate({ ral: 15_000, monthsWorked: 120, age: null }).months).toBe(24);
    // Less than 13 weeks of contributions: no NASpI.
    const few = naspiEstimate({ ral: 20_000, monthsWorked: 2, age: null });
    expect(few.eligible).toBe(false);
    expect(few.months).toBe(0);
  });

  it("drops 3% a month from the sixth month, from the eighth at 55", () => {
    const n = naspiEstimate({ ral: 28_000, monthsWorked: 60, age: 40 });
    expect(naspiNetInMonth(n, 5)).toBe(1262.69);
    expect(naspiNetInMonth(n, 6)).toBe(netOfIrpef(1311.69 * 0.97));
    expect(naspiNetInMonth(n, 7)).toBe(netOfIrpef(1311.69 * 0.97 * 0.97));
    expect(naspiNetInMonth(n, 25)).toBe(0);
    const older = naspiEstimate({ ral: 28_000, monthsWorked: 60, age: 56 });
    expect(older.fullMonths).toBe(7);
    expect(naspiNetInMonth(older, 7)).toBe(1262.69);
  });

  it("pays the last, partial month in proportion", () => {
    const n = naspiEstimate({ ral: 15_000, monthsWorked: 9, age: null });
    expect(naspiNetInMonth(n, 4)).toBe(n.net);
    expect(naspiNetInMonth(n, 5)).toBe(Math.round(n.net * 0.5 * 100) / 100);
    expect(naspiNetInMonth(n, 6)).toBe(0);
  });
});

describe("taxes", () => {
  it("uses the 2026 brackets and the work deduction", () => {
    expect(irpef(30_000)).toBe(28_000 * 0.23 + 2000 * 0.33);
    expect(irpef(60_000)).toBeCloseTo(6440 + 7260 + 4300, 6);
    expect(workDeduction(12_000)).toBe(1955);
    expect(workDeduction(21_500)).toBe(2505);
    expect(workDeduction(60_000)).toBe(0);
    // The NASpI ceiling, all year long: 19.016,40 € → 136,79 € of IRPEF a month.
    expect(netOfIrpef(1584.7)).toBe(1447.91);
  });

  it("estimates a RAL from a net monthly salary, over 13 payments", () => {
    expect(netFromRal(28_000) / 13).toBeCloseTo(1748, 0);
    expect(estimateRal(1748)).toBe(28_000);
    expect(estimateRal(1300)).toBe(18_800);
  });
});

const base = { liquid: 9000, income: 3200, expense: 2600, needs: 1700 };

describe("projections", () => {
  it("finds the month the money runs out, with a decimal", () => {
    const p = project(1000, () => -400);
    expect(p.held).toBe(2.5);
    expect(p.balances.slice(0, 4)).toEqual([1000, 600, 200, -200]);
    expect(project(-50, () => 100).held).toBe(0);
    expect(baselineProjection(base).held).toBeNull();
  });

  it("losing the job: the NASpI and the other incomes keep the space going", () => {
    const naspi = naspiEstimate({ ral: 28_000, monthsWorked: 60, age: 40 });
    expect(jobLoss(base, { salary: 1800, naspi: null, cutWants: false }).held).toBe(7.5);
    // 1.400 € still coming in plus the NASpI cover the months; then 1.200 € short each month.
    expect(jobLoss(base, { salary: 1800, naspi, cutWants: false }).held).toBe(27.3);
    // Only the needs: it holds past three years.
    expect(jobLoss(base, { salary: 1800, naspi, cutWants: true }).held).toBeNull();
    // A salary bigger than the space's income can't take more than all of it.
    expect(jobLoss(base, { salary: 5000, naspi: null, cutWants: false }).held).toBe(3.4);
  });

  it("an unexpected expense: what's left, what's missing and how long to rebuild it", () => {
    expect(unexpectedExpense(base, 5000)).toMatchObject({
      held: null,
      after: 4000,
      shortfall: 0,
      recovery: 9,
    });
    expect(unexpectedExpense(base, 5000).cushion).toBeCloseTo(1.54, 2);
    const short = unexpectedExpense({ ...base, liquid: 1200, income: 2500 }, 1500);
    expect(short).toMatchObject({
      after: -300,
      shortfall: 300,
      cushion: 0,
      recovery: null,
      held: 0,
    });
  });
});

describe("mortgage", () => {
  it("works out the months left and the new instalment", () => {
    expect(annuityPayment(120_000, 3, 240)).toBe(665.52);
    expect(remainingMonths(120_000, 3, 665.52)).toBe(240);
    expect(remainingMonths(120_000, 3, 300)).toBeNull();
    expect(remainingMonths(1200, 0, 100)).toBe(12);
    expect(annuityPayment(120_000, 5, 240)).toBe(791.95);
  });

  it("adds only the difference to the usual spending", () => {
    const loan = { balance: 120_000, rate: 3, payment: 665.52, months: 240 };
    expect(mortgageRise(base, loan, 2)).toMatchObject({
      payment: 791.95,
      delta: 126.43,
      saving: 473.57,
      held: null,
    });
    const tight = mortgageRise({ ...base, liquid: 500, income: 2700 }, loan, 2);
    expect(tight.saving).toBe(-26.43);
    expect(tight.held).toBe(18.9);
  });
});

describe("the verdict", () => {
  it("is tight under three months, to work on under six", () => {
    expect(toneFor(2.9)).toBe("danger");
    expect(toneFor(3)).toBe("warn");
    expect(toneFor(6)).toBe("ok");
    expect(toneFor(null)).toBe("ok");
  });

  it("sizes the emergency fund in months of spending", () => {
    expect(emergencyTarget(2600, 3)).toBe(7800);
    expect(emergencyTarget(2633.4, 3)).toBe(8000);
  });
});
