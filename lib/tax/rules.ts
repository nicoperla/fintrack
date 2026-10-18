/*
 * The rules of a tax year that the 730 journey needs. A tax year is the year of the income: the
 * 2026 income is filed with the 730/2027. It covers IRPEF, the deductions for work and family, and
 * the calendar of the season.
 *
 * Checked in October 2026 against the 730/2026 instructions (Agenzia delle Entrate, updated
 * 28 May 2026) and the 2026 budget law (L. 199/2025: second bracket at 33%). The 730/2027
 * calendar is the expected one. The dates set by law don't move (CU by 16 March, precompilato by
 * 30 April, deadline 30 September); the others are confirmed by the Agenzia every spring
 * (`provisional`).
 */

export const TAX_RULES_CHECKED_AT = "ottobre 2026";

export type Bracket = readonly [upTo: number, rate: number];

/** When the refund arrives (or the debt is withheld) for a 730 sent by `sentBy`: months 1–12 of the filing year. */
export type RefundSlot = {
  sentBy: string;
  employee: readonly [from: number, to: number];
  pensioner: readonly [from: number, to: number];
};

export type YearRules = {
  /** The income year. */
  year: number;
  /** "730/2027". */
  model: string;
  /** Some dates of the calendar still have to be confirmed by the Agenzia. */
  provisional: boolean;
  irpef: readonly Bracket[];
  calendar: {
    /** The employer or INPS hands over the Certificazione Unica by this day. */
    cu: string;
    /** The precompilato can be read from this day. */
    precompiled: string;
    /** …and accepted, changed and sent from this one. */
    sendFrom: string;
    /** A 730 sent alone can be cancelled once, by this day. */
    annulBy: string;
    /** Last day to send the 730. */
    deadline: string;
    /** To tell the employer to withhold a smaller second advance (or none). */
    advanceNoticeBy: string;
    /** 730 integrativo, only through a CAF or a professional, when it's in your favour. */
    integrativeBy: string;
    /** Modello Redditi, for whoever missed the 730 and has to file. */
    redditiBy: string;
  };
  refunds: readonly RefundSlot[];
};

const REFUND_PATTERN = (y: number): RefundSlot[] => [
  { sentBy: `${y}-05-31`, employee: [7, 7], pensioner: [8, 8] },
  { sentBy: `${y}-06-20`, employee: [7, 8], pensioner: [9, 9] },
  { sentBy: `${y}-07-15`, employee: [8, 9], pensioner: [10, 10] },
  { sentBy: `${y}-08-31`, employee: [10, 10], pensioner: [11, 11] },
  { sentBy: `${y}-09-30`, employee: [11, 11], pensioner: [12, 12] },
];

const YEARS: Record<number, YearRules> = {
  2025: {
    year: 2025,
    model: "730/2026",
    provisional: false,
    irpef: [
      [28_000, 0.23],
      [50_000, 0.35],
      [Infinity, 0.43],
    ],
    calendar: {
      cu: "2026-03-16",
      precompiled: "2026-04-30",
      sendFrom: "2026-05-14",
      annulBy: "2026-06-20",
      deadline: "2026-09-30",
      advanceNoticeBy: "2026-10-10",
      integrativeBy: "2026-10-26",
      redditiBy: "2026-11-02",
    },
    refunds: REFUND_PATTERN(2026),
  },
  2026: {
    year: 2026,
    model: "730/2027",
    provisional: true,
    irpef: [
      [28_000, 0.23],
      [50_000, 0.33],
      [Infinity, 0.43],
    ],
    calendar: {
      cu: "2027-03-16",
      precompiled: "2027-04-30",
      sendFrom: "2027-05-13",
      annulBy: "2027-06-20",
      deadline: "2027-09-30",
      advanceNoticeBy: "2027-10-10",
      integrativeBy: "2027-10-25",
      redditiBy: "2027-11-02",
    },
    refunds: REFUND_PATTERN(2027),
  },
};

export const SUPPORTED_YEARS = Object.keys(YEARS).map(Number);

/**
 * The rules for a year. Years after the last one checked reuse its rules, moved forward, until
 * the next budget law is in: better an estimate with last year's rates than none.
 */
export function rulesFor(year: number): YearRules {
  if (YEARS[year]) return YEARS[year];
  const known = SUPPORTED_YEARS.filter((y) => y <= year);
  const base = YEARS[known.length ? Math.max(...known) : Math.min(...SUPPORTED_YEARS)];
  const shift = year - base.year;
  const move = (iso: string) => `${Number(iso.slice(0, 4)) + shift}${iso.slice(4)}`;
  return {
    ...base,
    year,
    model: `730/${year + 1}`,
    provisional: true,
    calendar: Object.fromEntries(
      Object.entries(base.calendar).map(([k, v]) => [k, move(v)]),
    ) as YearRules["calendar"],
    refunds: REFUND_PATTERN(year + 1),
  };
}

const cents = (n: number) => Math.round(n * 100) / 100;
const ratio = (n: number) => Math.round(n * 10_000) / 10_000;

/** IRPEF before any deduction ("imposta lorda"). */
export function grossTax(income: number, rules: YearRules) {
  let tax = 0;
  let from = 0;
  for (const [to, rate] of rules.irpef) {
    if (income <= from) break;
    tax += (Math.min(income, to) - from) * rate;
    from = to;
  }
  return cents(tax);
}

/** The rate the last euro of income pays: what a deduzione is worth. */
export function marginalRate(income: number, rules: YearRules) {
  for (const [to, rate] of rules.irpef) if (income <= to) return rate;
  return rules.irpef[rules.irpef.length - 1][1];
}

/** Share of the year worked (or with a pension): the work deductions are proportioned to it. */
const share = (days: number) => Math.min(1, Math.max(0, days) / 365);

/** Employment income (table 6 of the instructions), with the 65 € bonus between 25.001 and 35.000 €. */
export function employeeDeduction(income: number, days = 365, fixedTerm = false) {
  // Up to 15.000 € it never goes below 690 € (1.380 € on a fixed-term contract), however short the job.
  if (income <= 15_000) return cents(Math.max(1955 * share(days), fixedTerm ? 1380 : 690));
  let base: number;
  if (income <= 28_000) base = 1910 + 1190 * ratio((28_000 - income) / 13_000);
  else if (income <= 50_000) base = 1910 * ratio((50_000 - income) / 22_000);
  else base = 0;
  if (income > 25_000 && income <= 35_000) base += 65;
  return cents(base * share(days));
}

/** Pensions (table 7), with the 50 € bonus between 25.001 and 29.000 €. */
export function pensionDeduction(income: number, days = 365) {
  if (income <= 8_500) return cents(Math.max(1955 * share(days), 713));
  let base: number;
  if (income <= 28_000) base = 700 + 1255 * ratio((28_000 - income) / 19_500);
  else if (income <= 50_000) base = 700 * ratio((50_000 - income) / 22_000);
  else base = 0;
  if (income > 25_000 && income <= 29_000) base += 50;
  return cents(base * share(days));
}

/** The tax wedge cut for employees from 2025 (L. 207/2024): 1.000 € from 20.000 to 32.000 €, then down to zero at 40.000 €. */
export function extraEmployeeDeduction(income: number) {
  if (income <= 20_000 || income > 40_000) return 0;
  if (income <= 32_000) return 1000;
  return cents(1000 * ratio((40_000 - income) / 8000));
}

/** Spouse with income up to 2.840,51 € (table 3). */
export function spouseDeduction(income: number) {
  if (income <= 15_000) return cents(800 - 110 * ratio(income / 15_000));
  if (income <= 40_000) {
    if (income > 29_000 && income <= 29_200) return 700;
    if (income > 29_200 && income <= 34_700) return 710;
    if (income > 34_700 && income <= 35_000) return 720;
    if (income > 35_000 && income <= 35_100) return 710;
    if (income > 35_100 && income <= 35_200) return 700;
    return 690;
  }
  if (income <= 80_000) return cents(690 * ratio((80_000 - income) / 40_000));
  return 0;
}

/**
 * Children from 21 to 30 (or disabled from 21) with income up to 4.000 € under 24, 2.840,51 €
 * after: 950 € each, falling with income (the threshold grows by 15.000 € per child after the
 * first). `sharePercent`: 50 split between the parents, 100 for one of them.
 */
export function childrenDeduction(income: number, children: number, sharePercent = 50) {
  if (children <= 0) return 0;
  const threshold = 95_000 + 15_000 * (children - 1);
  const factor = ratio((threshold - income) / threshold);
  if (factor <= 0) return 0;
  return cents(950 * children * Math.min(1, factor) * (sharePercent / 100));
}

/** Parents living with you and dependent on you (table 5): 750 € each, falling with income. */
export function parentsDeduction(income: number, parents: number) {
  if (parents <= 0 || income >= 80_000) return 0;
  return cents(750 * parents * ratio((80_000 - income) / 80_000));
}

/** Income limits to be a dependent relative. */
export const DEPENDENT_LIMITS = { childUnder24: 4000, other: 2840.51 } as const;

/** Where the dates, rates and amounts come from, for the page footer. */
export const TAX_SOURCES = [
  {
    label: "Istruzioni del modello 730/2026, Agenzia delle Entrate",
    url: "https://www.agenziaentrate.gov.it/portale/documents/20143/9764684/730_2026_istruzioni_+agg+28+05+2026.pdf/0965387c-8738-287a-9378-1d038b997833",
  },
  {
    label: "Legge di bilancio 2026: IRPEF al 33% tra 28.000 e 50.000 €",
    url: "https://www.fisco7.it/2026/01/legge-di-bilancio-aliquota-dal-35-al-33-riduzione-complicata-dellirpef/",
  },
  {
    label: "Il precompilato, passo per passo: Agenzia delle Entrate",
    url: "https://infoprecompilata.agenziaentrate.gov.it/portale/",
  },
] as const;
