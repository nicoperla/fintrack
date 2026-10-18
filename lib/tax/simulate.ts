import { RULES, type DeductionsSummary, type DeductionType } from "@/lib/finance/deductions";
import {
  childrenDeduction,
  employeeDeduction,
  extraEmployeeDeduction,
  grossTax,
  marginalRate,
  parentsDeduction,
  pensionDeduction,
  spouseDeduction,
  type YearRules,
} from "@/lib/tax/rules";
import type { Situation } from "@/lib/tax/situation";

/*
 * The estimate of the 730's result from the Certificazioni Uniche: IRPEF on all the income of the
 * year, minus the deductions (work, family, expenses, rent), against the IRPEF already withheld.
 * It's what explains the classic surprise of two jobs in one year: each employer withheld as if it
 * were the only one.
 *
 * Left out, and said on the page: regional and municipal surcharges, the trattamento integrativo
 * and the tax-free sum for incomes up to 20.000 € (the employer already pays them), income not
 * in a CU.
 */

export const CU_KINDS = ["employee", "pensioner", "other"] as const;
export type CuKind = (typeof CU_KINDS)[number];

export const CU_KIND_LABELS: Record<CuKind, string> = {
  employee: "Lavoro dipendente",
  pensioner: "Pensione",
  other: "Altro (lavoro occasionale, collaborazioni)",
};

export type CuEntry = {
  kind: CuKind;
  /** CU box 1 (permanent) or 2 (fixed term) for work, 3 for pensions. */
  income: number;
  /** CU box 6 (work) or 7 (pension). */
  days: number;
  /** CU box 21: IRPEF withheld. */
  withheld: number;
  fixedTerm: boolean;
};

export type CuData = { entries: CuEntry[] };

const cents = (n: number) => Math.round(n * 100) / 100;

const num = (v: unknown, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0;

/** The CU figures as stored (JSON), with anything unexpected dropped. */
export function readCu(raw: unknown): CuData {
  const o = (raw ?? {}) as Record<string, unknown>;
  const entries = Array.isArray(o.entries) ? o.entries : [];
  return {
    entries: entries.slice(0, 6).flatMap((e) => {
      const r = (e ?? {}) as Record<string, unknown>;
      const kind = CU_KINDS.includes(r.kind as CuKind) ? (r.kind as CuKind) : null;
      if (!kind) return [];
      return [
        {
          kind,
          income: num(r.income, 10_000_000),
          days: Math.round(num(r.days, 365)),
          withheld: num(r.withheld, 10_000_000),
          fixedTerm: r.fixedTerm === true,
        },
      ];
    }),
  };
}

/** Riordino delle detrazioni (art. 16-ter TUIR) for incomes over 75.000 €: the ceiling on expenses. */
export function riordinoCeiling(income: number, dependentChildren: number) {
  if (income <= 75_000) return Infinity;
  const base = income <= 100_000 ? 14_000 : 8_000;
  const coefficient =
    dependentChildren >= 3
      ? 1
      : dependentChildren === 2
        ? 0.85
        : dependentChildren === 1
          ? 0.7
          : 0.5;
  return base * coefficient;
}

/** Types whose 19% falls between 120.000 and 240.000 € of income (health and mortgage don't). */
const FALLING_OVER_120K: DeductionType[] = [
  "veterinarie",
  "istruzione",
  "sport",
  "asilo",
  "trasporto",
  "assicurazione",
  "universita",
  "funebri",
  "studenti",
];

export type Simulation = {
  income: number;
  grossTax: number;
  workDeduction: number;
  extraDeduction: number;
  familyDeduction: number;
  expensesDeduction: number;
  rentDeduction: number;
  /** IRPEF due after every deduction. */
  netTax: number;
  withheld: number;
  /** Positive: back to you. Negative: to pay. */
  result: number;
  /** Advance for next year, when the 730 ends up owing more than 51,65 €. */
  advance: { total: number; july: number; november: number };
  marginalRate: number;
};

export function simulate(input: {
  rules: YearRules;
  cu: CuData;
  situation: Situation;
  /** This person's deductible expenses of the year (with the marginal rate from simulateIncome). */
  summary: DeductionsSummary;
  /** The rent deduction due (lib/finance/rights.ts). */
  rent: number;
  /** This year's instalments of the home bonuses (lib/tax/home-bonus.ts). */
  homeBonus?: number;
  /** All dependent children, for the riordino coefficient. */
  dependentChildren: number;
}): Simulation | null {
  const { rules, cu, situation: s, summary } = input;
  if (!cu.entries.length) return null;

  const gross = cu.entries.reduce((sum, e) => sum + e.income, 0);
  // Deduzioni (pension funds, domestic workers' contributions) come off the income.
  const deduzioni = summary.byType
    .filter((t) => RULES[t.type].kind === "deduzione")
    .reduce((sum, t) => sum + t.base, 0);
  const income = cents(Math.max(0, gross - deduzioni));
  const tax = grossTax(income, rules);

  const days = (kind: CuKind) =>
    Math.min(
      365,
      cu.entries.filter((e) => e.kind === kind).reduce((sum, e) => sum + e.days, 0),
    );
  const employees = cu.entries.filter((e) => e.kind === "employee");
  const work =
    (employees.length
      ? employeeDeduction(
          income,
          days("employee"),
          employees.every((e) => e.fixedTerm),
        )
      : 0) +
    (cu.entries.some((e) => e.kind === "pensioner")
      ? pensionDeduction(income, days("pensioner"))
      : 0);
  const extra = employees.length ? extraEmployeeDeduction(income) : 0;
  const family =
    (s.spouse ? spouseDeduction(income) : 0) +
    childrenDeduction(income, s.children, s.childrenShare) +
    parentsDeduction(income, s.parents);

  // Expenses: their own rates and limits, then the ceilings for high incomes.
  const detrazioni = summary.byType.filter((t) => RULES[t.type].kind === "detrazione");
  const ceiling = riordinoCeiling(income, input.dependentChildren);
  let room = ceiling;
  let expenses = 0;
  for (const t of detrazioni) {
    // Health expenses are outside the riordino ceiling.
    const base = t.type === "sanitarie" ? t.base : Math.min(t.base, Math.max(0, room));
    if (t.type !== "sanitarie") room -= base;
    let value = base * RULES[t.type].rate;
    if (income > 120_000 && FALLING_OVER_120K.includes(t.type)) {
      value *= Math.max(0, (240_000 - income) / 120_000);
    }
    expenses += value;
  }
  expenses += input.homeBonus ?? 0;
  // From 2026, over 200.000 € the cut of the second bracket is taken back from the deductions.
  if (rules.year >= 2026 && income > 200_000) expenses = Math.max(0, expenses - 440);
  expenses = cents(expenses);

  const beforeRent = Math.max(0, tax - work - extra - family - expenses);
  // The rent deduction is paid back even when the tax isn't enough for it.
  const afterRent = beforeRent - input.rent;
  const netTax = cents(Math.max(0, afterRent));
  const rentCredit = afterRent < 0 ? -afterRent : 0;
  const withheld = cents(cu.entries.reduce((sum, e) => sum + e.withheld, 0));
  const result = cents(withheld + rentCredit - netTax);

  // The advance is due on the "differenza" when it's over 51,65 €: 40% in July and 60% in November,
  // all in November under 257,52 €.
  const owed = -result;
  const total = owed > 51.65 ? cents(owed) : 0;
  const july = total >= 257.52 ? cents(total * 0.4) : 0;
  return {
    income,
    grossTax: tax,
    workDeduction: cents(work),
    extraDeduction: extra,
    familyDeduction: cents(family),
    expensesDeduction: expenses,
    rentDeduction: input.rent,
    netTax,
    withheld,
    result,
    advance: { total, july, november: cents(total - july) },
    marginalRate: marginalRate(income, rules),
  };
}

/**
 * "Capienza": the IRPEF left after the deductions for work and family, i.e. how much the expense
 * deductions can still take off. Below zero they'd be lost. Only from the CU and the answers, so
 * it can be told to a partner without showing any expense.
 */
export function taxRoom(cu: CuData, situation: Situation, rules: YearRules) {
  if (!cu.entries.length) return null;
  const income = cu.entries.reduce((sum, e) => sum + e.income, 0);
  const days = (kind: CuKind) =>
    Math.min(
      365,
      cu.entries.filter((e) => e.kind === kind).reduce((sum, e) => sum + e.days, 0),
    );
  const employees = cu.entries.filter((e) => e.kind === "employee");
  const work =
    (employees.length
      ? employeeDeduction(
          income,
          days("employee"),
          employees.every((e) => e.fixedTerm),
        )
      : 0) +
    (cu.entries.some((e) => e.kind === "pensioner")
      ? pensionDeduction(income, days("pensioner"))
      : 0);
  const extra = employees.length ? extraEmployeeDeduction(income) : 0;
  const family =
    (situation.spouse ? spouseDeduction(income) : 0) +
    childrenDeduction(income, situation.children, situation.childrenShare) +
    parentsDeduction(income, situation.parents);
  return cents(grossTax(income, rules) - work - extra - family);
}

export type Capacity = "none" | "low" | "enough";

/** The room in words: none (deductions lost), low (some lost), enough. */
export function capacityOf(room: number, expenses = 500): Capacity {
  if (room <= 0) return "none";
  return room < Math.max(expenses, 1) ? "low" : "enough";
}

/** The marginal rate from the CU incomes, before the expenses are summarized. */
export function marginalFromCu(cu: CuData, rules: YearRules) {
  const gross = cu.entries.reduce((sum, e) => sum + e.income, 0);
  return gross > 0 ? marginalRate(gross, rules) : null;
}
