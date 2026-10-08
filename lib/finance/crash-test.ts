/*
 * "Il crash test": what happens to the space's money if the user loses their job, an unexpected
 * expense arrives or the mortgage rate goes up. Months of autonomy from today's liquid money and
 * the usual monthly income and spending, with the NASpI worked out by the INPS rules. Estimates,
 * not advice: every result ends with the emergency fund, never with a product.
 */

const cents = (n: number) => Math.round(n * 100) / 100;
const WEEKS_PER_MONTH = 52 / 12;

/** How far the projections go: three years. */
export const HORIZON_MONTHS = 36;

// ---------- NASpI ----------

/**
 * The 2026 NASpI (d.lgs. 22/2015, as changed by L. 234/2021). Amounts from INPS, circolare n. 4
 * del 28 gennaio 2026; they're updated every January.
 */
export const NASPI = {
  year: 2026,
  /** Up to this average monthly pay the benefit is 75% of it; above, plus 25% of the rest. */
  threshold: 1456.72,
  /** Gross monthly ceiling. */
  max: 1584.7,
  /** At least 13 weeks of contributions in the last four years. */
  minWeeks: 13,
  /** Half the weeks of the last four years, at most 104 weeks (two years). */
  maxWeeks: 104,
  /** Months paid in full: then it drops 3% a month (from the eighth month at 55 or older). */
  fullMonths: 5,
  fullMonthsFrom55: 7,
  monthlyCut: 0.03,
  source: "INPS, circolare n. 4 del 28 gennaio 2026",
  url: "https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa.html",
} as const;

export type NaspiEstimate = {
  eligible: boolean;
  /** Average monthly pay the benefit is worked out from (RAL / 12). */
  averagePay: number;
  /** Gross for the months paid in full. */
  gross: number;
  /** The same after IRPEF, an estimate. */
  net: number;
  /** How long it lasts, in months (can end mid-month). */
  months: number;
  /** Months before it starts dropping. */
  fullMonths: number;
  capped: boolean;
};

/** IRPEF 2026: 23% to 28.000 €, 33% to 50.000 € (L. 199/2025), 43% above. */
export function irpef(income: number) {
  const brackets: [number, number][] = [
    [28_000, 0.23],
    [50_000, 0.33],
    [Infinity, 0.43],
  ];
  let tax = 0;
  let from = 0;
  for (const [to, rate] of brackets) {
    if (income <= from) break;
    tax += (Math.min(income, to) - from) * rate;
    from = to;
  }
  return tax;
}

/** Deduction for employment income, art. 13 TUIR; it applies to the NASpI as well. */
export function workDeduction(income: number) {
  if (income <= 15_000) return 1955;
  if (income <= 28_000) return 1910 + (1190 * (28_000 - income)) / 13_000;
  if (income <= 50_000) return (1910 * (50_000 - income)) / 22_000;
  return 0;
}

/** A monthly gross amount after IRPEF, as if it lasted all year. Regional surcharges aside. */
export function netOfIrpef(monthlyGross: number) {
  const yearly = monthlyGross * 12;
  const tax = Math.max(0, irpef(yearly) - workDeduction(yearly));
  return cents(monthlyGross - tax / 12);
}

export function naspiEstimate(input: {
  /** Gross yearly pay (RAL). */
  ral: number;
  /** Months with contributions in the last four years (more are counted as 48). */
  monthsWorked: number;
  age: number | null;
}): NaspiEstimate {
  const averagePay = cents(input.ral / 12);
  const raw =
    averagePay <= NASPI.threshold
      ? averagePay * 0.75
      : NASPI.threshold * 0.75 + (averagePay - NASPI.threshold) * 0.25;
  const gross = cents(Math.min(NASPI.max, raw));
  const weeks = Math.min(48, Math.max(0, input.monthsWorked)) * WEEKS_PER_MONTH;
  const eligible = weeks >= NASPI.minWeeks && gross > 0;
  return {
    eligible,
    averagePay,
    gross,
    net: netOfIrpef(gross),
    months: eligible
      ? Math.round((Math.min(NASPI.maxWeeks, weeks / 2) / WEEKS_PER_MONTH) * 10) / 10
      : 0,
    fullMonths: input.age !== null && input.age >= 55 ? NASPI.fullMonthsFrom55 : NASPI.fullMonths,
    capped: raw > NASPI.max,
  };
}

/** What the NASpI pays, after IRPEF, in month `m` (1 = the first): less every month after the full ones. */
export function naspiNetInMonth(n: NaspiEstimate, m: number) {
  if (!n.eligible || m < 1 || m > Math.ceil(n.months)) return 0;
  const share = Math.min(1, n.months - (m - 1));
  const cut = m > n.fullMonths ? Math.pow(1 - NASPI.monthlyCut, m - n.fullMonths) : 1;
  return cents(netOfIrpef(n.gross * cut) * share);
}

/**
 * A net salary's RAL, roughly: 9,19% of contributions, IRPEF with the work deduction and the
 * 2025 tax wedge cut (L. 207/2024), over 13 monthly payments. A starting point to correct with
 * the payslip, nothing more.
 */
export function netFromRal(ral: number) {
  const income = ral * (1 - 0.0919);
  let tax = irpef(income) - workDeduction(income);
  if (income > 20_000 && income <= 40_000) {
    tax -= income <= 32_000 ? 1000 : (1000 * (40_000 - income)) / 8000;
  }
  const bonus =
    income <= 8500
      ? income * 0.071
      : income <= 15_000
        ? income * 0.053
        : income <= 20_000
          ? income * 0.048
          : 0;
  return income - Math.max(0, tax) + bonus;
}

export function estimateRal(netMonthly: number) {
  const target = netMonthly * 13;
  let low = 0;
  let high = 500_000;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (netFromRal(mid) < target) low = mid;
    else high = mid;
  }
  return Math.round(high / 100) * 100;
}

// ---------- Projections ----------

/** The space's starting point: money at hand today and a usual month. */
export type Baseline = {
  /** Everyday accounts and savings: what can be spent straight away. Investments aside. */
  liquid: number;
  income: number;
  expense: number;
  /** The part of `expense` that goes to needs (home, groceries, transport…). */
  needs: number;
};

export type Projection = {
  /** Balance at the end of each month; index 0 is today. */
  balances: number[];
  /** Months until the money runs out, with a decimal; null when it lasts past the horizon. */
  held: number | null;
};

export function project(start: number, flow: (month: number) => number): Projection {
  const balances = [cents(start)];
  let held: number | null = start < 0 ? 0 : null;
  let balance = start;
  for (let m = 1; m <= HORIZON_MONTHS; m++) {
    const f = flow(m);
    const next = balance + f;
    if (held === null && next < 0) held = Math.floor((m - 1 + balance / -f) * 10) / 10;
    balance = next;
    balances.push(cents(balance));
  }
  return { balances, held };
}

export const baselineProjection = (b: Baseline) => project(b.liquid, () => b.income - b.expense);

/** Losing the job: the user's salary stops, the NASpI comes in, the rest of the space's income stays. */
export function jobLoss(
  b: Baseline,
  input: { salary: number; naspi: NaspiEstimate | null; cutWants: boolean },
) {
  const kept = Math.max(0, b.income - input.salary);
  const spend = input.cutWants ? b.needs : b.expense;
  const naspi = input.naspi;
  return project(b.liquid, (m) => kept + (naspi ? naspiNetInMonth(naspi, m) : 0) - spend);
}

/** An expense paid today out of the money at hand; then the usual months. */
export function unexpectedExpense(b: Baseline, amount: number) {
  const after = b.liquid - amount;
  const saving = b.income - b.expense;
  return {
    ...project(after, () => saving),
    after: cents(after),
    shortfall: cents(Math.max(0, -after)),
    /** Months of usual spending left after paying it. */
    cushion: b.expense > 0 ? Math.max(0, after) / b.expense : null,
    /** Months to put the money back aside, saving as usual; null when there's no saving. */
    recovery: saving > 0 ? Math.ceil(amount / saving) : null,
  };
}

/** Months left on a loan at `rate` (TAN, %) paying `payment` a month; null when it never ends. */
export function remainingMonths(balance: number, rate: number, payment: number) {
  if (balance <= 0) return 0;
  const r = rate / 100 / 12;
  if (r === 0) return Math.ceil(balance / payment);
  if (payment <= balance * r) return null;
  return Math.ceil(-Math.log(1 - (r * balance) / payment) / Math.log(1 + r));
}

/** The French (constant) instalment of a loan. */
export function annuityPayment(balance: number, rate: number, months: number) {
  const r = rate / 100 / 12;
  if (months <= 0) return balance;
  if (r === 0) return cents(balance / months);
  return cents((balance * r) / (1 - Math.pow(1 + r, -months)));
}

/**
 * A variable-rate mortgage `points` higher for what's left of it. The current instalment is
 * already in the usual spending: only the difference is added.
 */
export function mortgageRise(
  b: Baseline,
  loan: { balance: number; rate: number; payment: number; months: number },
  points: number,
) {
  const payment = annuityPayment(loan.balance, loan.rate + points, loan.months);
  const delta = cents(payment - loan.payment);
  const saving = cents(b.income - b.expense - delta);
  return { ...project(b.liquid, () => saving), payment, delta, saving };
}

// ---------- The verdict ----------

export type Tone = "ok" | "warn" | "danger";

/** Under three months it's tight, under six worth working on, then it holds. */
export const toneFor = (held: number | null): Tone =>
  held === null || held >= 6 ? "ok" : held >= 3 ? "warn" : "danger";

/** The emergency fund: months of usual spending, rounded up to 100. */
export const emergencyTarget = (expense: number, months: number) =>
  Math.ceil((expense * months) / 100) * 100;

// ---------- The job, saved per person ----------

export const WORK_KINDS = ["employee", "self-employed", "other"] as const;
export type WorkKind = (typeof WORK_KINDS)[number];

export const WORK_LABELS: Record<WorkKind, string> = {
  employee: "Dipendente",
  "self-employed": "Partita IVA o collaborazione",
  other: "Altro (pensione, studio…)",
};

/** Saved in `users.crash_profile`: the NASpI is everyone's own. */
export type CrashProfile = {
  work: WorkKind | null;
  /** Gross yearly pay, from the contract or the payslip. */
  ral: number | null;
  /** "YYYY-MM": working with contributions without a break since then. */
  since: string | null;
};

export const EMPTY_CRASH_PROFILE: CrashProfile = { work: null, ral: null, since: null };

export function readCrashProfile(raw: unknown): CrashProfile {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    work: WORK_KINDS.includes(o.work as WorkKind) ? (o.work as WorkKind) : null,
    ral: typeof o.ral === "number" && Number.isFinite(o.ral) && o.ral > 0 ? o.ral : null,
    since: typeof o.since === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(o.since) ? o.since : null,
  };
}

/** Months from "YYYY-MM" to the current month (0-based `month`), at most four years. */
export function monthsWorkedSince(since: string, today: { year: number; month: number }) {
  const [year, month] = since.split("-").map(Number);
  return Math.max(0, Math.min(48, (today.year - year) * 12 + today.month - (month - 1)));
}

/** The goal every result points to; an existing one with a similar name counts too. */
export const EMERGENCY_GOAL = {
  name: "Fondo emergenza",
  icon: "piggy-bank",
  color: "#22c55e",
  pattern: /emergenz|imprevist|cuscinett/i,
} as const;
