import { describe, expect, it } from "vitest";
import { summarizeDeductions } from "@/lib/finance/deductions";
import { rulesFor } from "./rules";
import { EMPTY_SITUATION, type Situation } from "./situation";
import { capacityOf, readCu, riordinoCeiling, simulate, taxRoom, type CuEntry } from "./simulate";

const rules = rulesFor(2026);
const situation: Situation = {
  ...EMPTY_SITUATION,
  work: "employee",
  agent: true,
  home: "owner",
  answeredAt: "2026-10-18T10:00:00.000Z",
};
const none = summarizeDeductions([], 0);
const job = (income: number, days: number, withheld: number): CuEntry => ({
  kind: "employee",
  income,
  days,
  withheld,
  fixedTerm: false,
});
const run = (entries: CuEntry[], extra: { rent?: number; s?: Situation } = {}) =>
  simulate({
    rules,
    cu: { entries },
    situation: extra.s ?? situation,
    summary: none,
    rent: extra.rent ?? 0,
    dependentChildren: 0,
  })!;

describe("simulate", () => {
  it("finds nothing to pay or get back when one employer withheld right", () => {
    // 7.100 of IRPEF − 1.801,38 for work − 1.000 of wedge cut = 4.298,62.
    const sim = run([job(30_000, 365, 4298.62)]);
    expect(sim.netTax).toBe(4298.62);
    expect(sim.result).toBe(0);
    expect(sim.advance.total).toBe(0);
  });

  it("shows the debt of two jobs in one year, with next year's advance", () => {
    // Each employer withheld as if 18.000 € were the whole income.
    const sim = run([job(18_000, 182, 2731), job(18_000, 183, 2731)]);
    expect(sim.income).toBe(36_000);
    expect(sim.netTax).toBe(7364.48); // 9.080 − 1.215,52 − 500
    expect(sim.result).toBe(-1902.48);
    expect(sim.advance).toEqual({ total: 1902.48, july: 760.99, november: 1141.49 });
  });

  it("pays back the rent deduction even when the tax isn't enough", () => {
    const sim = run([job(9_000, 365, 115)], { rent: 991.6 });
    expect(sim.netTax).toBe(0);
    expect(sim.result).toBe(991.6);
  });

  it("counts deduzioni off the income and detrazioni off the tax", () => {
    const summary = summarizeDeductions(
      [
        {
          id: "1",
          date: "2026-05-10",
          description: "Versamento fondo pensione",
          amount: 1000,
          account: "Conto",
          accountType: "CHECKING",
          memberId: "u",
          category: "Altro",
          parent: null,
          override: "previdenza",
        },
        {
          id: "2",
          date: "2026-05-10",
          description: "Clinica Fido",
          amount: 300,
          account: "Conto",
          accountType: "CHECKING",
          memberId: "u",
          category: "Veterinario",
          parent: "Animali",
          override: null,
        },
      ],
      0,
    );
    const sim = simulate({
      rules,
      cu: { entries: [job(30_000, 365, 4298.62)] },
      situation,
      summary,
      rent: 0,
      dependentChildren: 0,
    })!;
    expect(sim.income).toBe(29_000);
    expect(sim.expensesDeduction).toBe(32.47); // (300 − 129,11) × 19%
    expect(sim.result).toBeGreaterThan(0);
  });

  it("caps expenses over 75.000 € and keeps only plausible CU figures", () => {
    expect(riordinoCeiling(70_000, 0)).toBe(Infinity);
    expect(riordinoCeiling(90_000, 0)).toBe(7000);
    expect(riordinoCeiling(120_000, 3)).toBe(8000);
    const cu = readCu({
      entries: [{ kind: "employee", income: 20000, days: 500, withheld: -3 }, { kind: "boss" }],
    });
    expect(cu.entries).toEqual([
      { kind: "employee", income: 20000, days: 365, withheld: 0, fixedTerm: false },
    ]);
  });

  it("tells a partner the room for deductions in words only", () => {
    expect(taxRoom({ entries: [] }, situation, rules)).toBeNull();
    const room = taxRoom({ entries: [job(9_000, 365, 0)] }, situation, rules)!;
    expect(room).toBe(115);
    expect(capacityOf(room, 300)).toBe("low");
    expect(capacityOf(-10)).toBe("none");
    expect(capacityOf(2000, 300)).toBe("enough");
  });
});
