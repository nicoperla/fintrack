/*
 * An estimate of the ISEE, before filing the DSU: enough to know which bonuses are worth asking
 * for. The real figure is the INPS's, from the DSU.
 *
 * ISEE = (ISR + 20% of ISP) / equivalence scale (DPCM 159/2013).
 * - ISR: the family's income, minus 20% of employment income (up to 3.000 € each) and of
 *   pensions (up to 1.000 € each), minus the rent (up to 7.000 €, +500 € per child from the
 *   third).
 * - ISP: savings above a threshold (6.000 € + 2.000 € per person after the first, up to
 *   10.000 €, +1.000 € per child from the third; BTP and postal bonds up to 50.000 € left out),
 *   plus homes at their IMU value minus the mortgage left, the main home only above a
 *   threshold and for two thirds.
 *
 * From 2026 (L. 199/2025, art. 1 c. 208) Assegno unico, bonus nido, bonus nuovi nati, ADI and SFL
 * use a kinder version: main home threshold 91.500 € (120.000 € in the 15 capitals of
 * metropolitan cities), +2.500 € per child from the second, and bigger additions to the scale
 * for two or more children. Left out of both: the notional return on savings and the special
 * deductions for disability expenses. Checked in October 2026.
 */

export const ISEE_ESTIMATE_CHECKED_AT = "ottobre 2026";

export type IseeInput = {
  /** People in the family (nucleo ISEE). */
  people: number;
  children: number;
  /** At least one child under 18, one under 3. */
  minorChildren: boolean;
  childUnder3: boolean;
  /** Both parents (or the only one) worked at least six months in the income year. */
  parentsWorking: boolean;
  disabled: number;
  /** Reddito complessivo of everyone in the family, two years before. */
  income: number;
  /** Of which employment income, and how many people earned it. */
  employmentIncome: number;
  employees: number;
  pensionIncome: number;
  pensioners: number;
  /** Rent paid in the year for the home the family lives in. */
  rent: number;
  /** Bank accounts, deposits, investments: for current accounts the higher of 31/12 balance and average. */
  savings: number;
  /** BTP, BOT, postal bonds and savings books: left out up to 50.000 €. */
  stateBonds: number;
  /** Main home: rendita catastale (0 if not owned) and the mortgage left on 31/12. */
  homeRendita: number;
  homeMortgage: number;
  /** The home is in one of the 15 capitals of metropolitan cities. */
  metroCapital: boolean;
  /** Other buildings, at their IMU value, minus their mortgages. */
  otherProperty: number;
};

export const EMPTY_ISEE_INPUT: IseeInput = {
  people: 1,
  children: 0,
  minorChildren: false,
  childUnder3: false,
  parentsWorking: false,
  disabled: 0,
  income: 0,
  employmentIncome: 0,
  employees: 0,
  pensionIncome: 0,
  pensioners: 0,
  rent: 0,
  savings: 0,
  stateBonds: 0,
  homeRendita: 0,
  homeMortgage: 0,
  metroCapital: false,
  otherProperty: 0,
};

const cents = (n: number) => Math.round(n * 100) / 100;
const pos = (n: number) => Math.max(0, n);

/** The equivalence scale by family size: 1, 1,57, 2,04, 2,46, 2,85, then +0,35 each. */
export function baseScale(people: number) {
  const table = [1, 1, 1.57, 2.04, 2.46, 2.85];
  const n = Math.max(1, Math.round(people));
  return n <= 5 ? table[n] : 2.85 + 0.35 * (n - 5);
}

/** The additions for children: the 2026 rules for family benefits add some from the second child. */
export function childrenAddition(children: number, family: boolean) {
  if (family) {
    if (children >= 5) return 0.55;
    if (children === 4) return 0.4;
    if (children === 3) return 0.25;
    if (children === 2) return 0.1;
    return 0;
  }
  if (children >= 5) return 0.5;
  if (children === 4) return 0.35;
  if (children === 3) return 0.2;
  return 0;
}

export function scaleOf(input: IseeInput, family: boolean) {
  let scale = baseScale(input.people) + childrenAddition(input.children, family);
  if (input.minorChildren && input.parentsWorking) scale += input.childUnder3 ? 0.3 : 0.2;
  scale += 0.5 * Math.max(0, input.disabled);
  return Math.round(scale * 100) / 100;
}

/** IMU value of a home from its rendita catastale (A categories): rendita × 1,05 × 160. */
export const imuValue = (rendita: number) => cents(rendita * 1.05 * 160);

export type IseeEstimate = {
  isr: number;
  isp: number;
  scale: number;
  isee: number;
};

function estimate(input: IseeInput, family: boolean): IseeEstimate {
  const children = Math.max(0, input.children);
  // Income, with the allowances for workers, pensioners and rent.
  const workAllowance = Math.min(input.employmentIncome * 0.2, 3000 * Math.max(1, input.employees));
  const pensionAllowance = Math.min(
    input.pensionIncome * 0.2,
    1000 * Math.max(1, input.pensioners),
  );
  const rentAllowance = Math.min(input.rent, 7000 + 500 * Math.max(0, children - 2));
  const isr = pos(
    input.income -
      (input.employmentIncome > 0 ? workAllowance : 0) -
      (input.pensionIncome > 0 ? pensionAllowance : 0) -
      rentAllowance,
  );

  // Savings, above their threshold.
  const threshold =
    Math.min(10_000, 6000 + 2000 * Math.max(0, input.people - 1)) +
    1000 * Math.max(0, children - 2);
  const bondsCounted = pos(input.stateBonds - 50_000);
  const savings = pos(input.savings + bondsCounted - threshold);

  // The main home, above its threshold, for two thirds; other buildings in full.
  const home = pos(imuValue(input.homeRendita) - input.homeMortgage);
  const homeThreshold = family
    ? (input.metroCapital ? 120_000 : 91_500) + 2500 * Math.max(0, children - 1)
    : 52_500 + 2500 * Math.max(0, children - 2);
  const homeCounted = (pos(home - homeThreshold) * 2) / 3;
  const isp = savings + homeCounted + pos(input.otherProperty);

  const scale = scaleOf(input, family);
  return {
    isr: cents(isr),
    isp: cents(isp),
    scale,
    isee: cents((isr + 0.2 * isp) / scale),
  };
}

/**
 * Both ISEEs: the ordinary one (bonus bollette, carta acquisti, university fees…) and, from 2026,
 * the one for Assegno unico, bonus nido, bonus nuovi nati, ADI and SFL.
 */
export function estimateIsee(input: IseeInput) {
  return { ordinary: estimate(input, false), family: estimate(input, true) };
}
