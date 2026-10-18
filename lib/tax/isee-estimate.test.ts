import { describe, expect, it } from "vitest";
import {
  EMPTY_ISEE_INPUT,
  baseScale,
  childrenAddition,
  estimateIsee,
  imuValue,
  scaleOf,
} from "./isee-estimate";

describe("equivalence scale", () => {
  it("grows with the family", () => {
    expect([1, 2, 3, 4, 5].map(baseScale)).toEqual([1, 1.57, 2.04, 2.46, 2.85]);
    expect(baseScale(7)).toBe(3.55);
  });

  it("adds more for children with the 2026 rules for family benefits", () => {
    expect(childrenAddition(2, false)).toBe(0);
    expect(childrenAddition(2, true)).toBe(0.1);
    expect(childrenAddition(3, false)).toBe(0.2);
    expect(childrenAddition(3, true)).toBe(0.25);
    expect(childrenAddition(6, true)).toBe(0.55);
  });

  it("adds for working parents with young children and for disability", () => {
    const family = {
      ...EMPTY_ISEE_INPUT,
      people: 3,
      children: 1,
      minorChildren: true,
      parentsWorking: true,
    };
    expect(scaleOf(family, false)).toBe(2.24); // 2,04 + 0,2
    expect(scaleOf({ ...family, childUnder3: true }, false)).toBe(2.34); // + 0,3 instead
    expect(scaleOf({ ...family, disabled: 1 }, false)).toBe(2.74);
  });
});

describe("estimateIsee", () => {
  it("works out a single tenant", () => {
    const { ordinary, family } = estimateIsee({
      ...EMPTY_ISEE_INPUT,
      income: 20_000,
      employmentIncome: 20_000,
      employees: 1,
      rent: 6000,
      savings: 8000,
    });
    // 20.000 − 3.000 (work) − 6.000 (rent) = 11.000; savings 8.000 − 6.000 = 2.000 at 20%.
    expect(ordinary).toEqual({ isr: 11_000, isp: 2000, scale: 1, isee: 11_400 });
    expect(family.isee).toBe(11_400);
  });

  it("weighs the home less for family benefits from 2026", () => {
    const { ordinary, family } = estimateIsee({
      ...EMPTY_ISEE_INPUT,
      people: 4,
      children: 2,
      minorChildren: true,
      childUnder3: true,
      parentsWorking: true,
      income: 50_000,
      employmentIncome: 50_000,
      employees: 2,
      savings: 20_000,
      homeRendita: 1000, // 168.000 € IMU value
      homeMortgage: 50_000,
    });
    expect(imuValue(1000)).toBe(168_000);
    // Home 118.000: over 52.500 (ordinary) or 94.000 (91.500 + 2.500 for the second child), × 2/3.
    expect(ordinary.isp).toBe(53_666.67);
    expect(family.isp).toBe(26_000);
    expect(ordinary.scale).toBe(2.76);
    expect(family.scale).toBe(2.86);
    expect(ordinary.isee).toBe(19_830.92);
    expect(family.isee).toBe(17_202.8);
  });

  it("leaves out state bonds up to 50.000 € and the home in big capitals up to 120.000 €", () => {
    const { family } = estimateIsee({
      ...EMPTY_ISEE_INPUT,
      stateBonds: 60_000,
      homeRendita: 600, // 100.800 € IMU value
      metroCapital: true,
    });
    // 10.000 of bonds over the limit, 4.000 over the savings threshold; the home doesn't count.
    expect(family.isp).toBe(4000);
    expect(family.isee).toBe(800);
  });
});
