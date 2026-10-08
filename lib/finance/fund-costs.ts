/*
 * "Radiografia dei costi": what the costs declared in a product's KID take away in euros over 10,
 * 20 and 30 years, next to the average of its category (ESMA). Only the product's own costs and
 * public averages: never "keep", "sell" or a named alternative, which would be investment advice
 * (art. 1, c. 5-septies TUF). What's left to the user are questions for whoever sold it.
 */

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Ongoing charges of EU retail UCITS, per year, averages 2020–2024. ESMA, "Costs and Performance
 * of EU Retail Investment Products 2025" (ESMA50-1949966494-4065, March 2026), essential
 * statistics: equity 1,38%, bond 0,87%, mixed 1,47%, equity ETFs 0,22%.
 */
export const ESMA_REFERENCE = {
  source: "ESMA, Costs and Performance of EU Retail Investment Products 2025",
  period: "2020-2024",
  url: "https://www.esma.europa.eu/sites/default/files/2026-03/ESMA50-1949966494-4065_Market_Report_-_Costs_and_Performance_of_EU_Retail_Investment_Products.pdf",
} as const;

export const FUND_CATEGORIES = ["equity", "bond", "mixed", "etf-equity", "other"] as const;
export type FundCategory = (typeof FUND_CATEGORIES)[number];

export const FUND_CATEGORY_INFO: Record<
  FundCategory,
  { label: string; plural: string; ongoing: number | null }
> = {
  equity: { label: "Fondo azionario", plural: "dei fondi azionari", ongoing: 1.38 },
  bond: { label: "Fondo obbligazionario", plural: "dei fondi obbligazionari", ongoing: 0.87 },
  mixed: { label: "Fondo bilanciato o flessibile", plural: "dei fondi bilanciati", ongoing: 1.47 },
  "etf-equity": { label: "ETF azionario", plural: "degli ETF azionari", ongoing: 0.22 },
  // Insurance products (unit-linked, multiramo) and pension funds have their own statistics.
  other: { label: "Altro: polizza, fondo pensione…", plural: "", ongoing: null },
};

/** Percentages as the KID writes them: 1,85 means 1,85%. */
export type FundCosts = {
  /** One-off, on every amount paid in. */
  entry: number;
  /** One-off, on what is taken out at the end. */
  exit: number;
  /** Management fees and other administrative or operating costs, per year. */
  ongoing: number;
  /** Transaction costs, per year. */
  transaction: number;
  /** Performance fees, per year (the KID shows an average). */
  performance: number;
};

/** Everything taken every year: the figure to compare with the category's ongoing charges. */
export const yearlyCost = (c: FundCosts) => c.ongoing + c.transaction + c.performance;

export const HORIZONS = [10, 20, 30] as const;

export type CostProjection = {
  /** Value at the end of each year without any cost; index 0 is today. */
  gross: number[];
  /** The same with the product's costs, the exit cost taken at the end of each year shown. */
  net: number[];
  /** What the costs take away by each horizon: lost value, compounding included. */
  byHorizon: { years: number; gross: number; net: number; cost: number; share: number }[];
};

/**
 * Month by month for 30 years: today's value plus a monthly payment, growing at the same gross
 * return with and without the costs. The ongoing costs are taken a twelfth a month, the entry
 * cost on each payment, the exit cost on the final value.
 */
export function projectCosts(input: {
  value: number;
  monthly: number;
  /** Assumed gross yearly return, in percent: the same for everyone, not a forecast. */
  grossReturn: number;
  costs: FundCosts;
}): CostProjection {
  const r = input.grossReturn / 100 / 12;
  const keep = 1 - yearlyCost(input.costs) / 100 / 12;
  const paidIn = input.monthly * (1 - input.costs.entry / 100);
  const exit = 1 - input.costs.exit / 100;
  const years = HORIZONS[HORIZONS.length - 1];

  const gross = [cents(input.value)];
  const net = [cents(input.value * exit)];
  let a = input.value;
  let b = input.value;
  for (let m = 1; m <= years * 12; m++) {
    a = a * (1 + r) + input.monthly;
    b = b * (1 + r) * keep + paidIn;
    if (m % 12 === 0) {
      gross.push(cents(a));
      net.push(cents(b * exit));
    }
  }
  return {
    gross,
    net,
    byHorizon: HORIZONS.map((y) => ({
      years: y,
      gross: gross[y],
      net: net[y],
      cost: cents(gross[y] - net[y]),
      share: gross[y] > 0 ? (gross[y] - net[y]) / gross[y] : 0,
    })),
  };
}

export type Comparison = "above" | "inline" | "below";

/** Within 10% of the category average it's in line: the average is a broad figure. */
export function compareWithCategory(costs: FundCosts, category: FundCategory) {
  const reference = FUND_CATEGORY_INFO[category].ongoing;
  if (reference === null) return null;
  const yearly = yearlyCost(costs);
  const verdict: Comparison =
    yearly > reference * 1.1 ? "above" : yearly < reference * 0.9 ? "below" : "inline";
  return { reference, yearly, verdict };
}

/**
 * Questions for the advisor or the bank, from the costs entered. Questions, not advice: the
 * answers and the choice stay with the user.
 */
export function advisorQuestions(costs: FundCosts, category: FundCategory) {
  const questions: string[] = [
    "Quanto pago in tutto ogni anno per questo prodotto, in euro?",
    "Quanta parte di questi costi va a chi me l'ha venduto, come incentivo?",
  ];
  const comparison = compareWithCategory(costs, category);
  if (comparison?.verdict === "above") {
    questions.push(
      `Perché costa più della media ${FUND_CATEGORY_INFO[category].plural} venduti nell'Unione europea?`,
    );
  }
  questions.push(
    "Negli ultimi 5 e 10 anni ha fatto meglio del suo indice di riferimento, al netto dei costi?",
  );
  if (costs.entry > 0) {
    questions.push("I costi di ingresso si pagano su ogni versamento? Si possono ridurre?");
  }
  if (costs.exit > 0) {
    questions.push("Quanto pago se esco prima? Dopo quanto tempo l'uscita non costa più niente?");
  }
  if (costs.performance > 0) {
    questions.push(
      "Come si calcola la commissione di performance? La pago anche dopo un anno in perdita?",
    );
  }
  questions.push("Esistono classi di questo stesso prodotto con costi più bassi, e posso averle?");
  return questions;
}
