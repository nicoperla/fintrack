import { looksLikeBankFee, yearlyFromMonths } from "@/lib/finance/found-money";
import {
  BANK_ACCOUNTS,
  CAR_INSURANCE,
  CAR_PROVINCES,
  CAR_PROVINCE_PERCENTILES,
  ELECTRICITY,
  type AgeBand,
  type BankAccountKind,
  type Percentiles,
} from "@/lib/finance/tariff-data";

/*
 * "Il Tariffometro": what the user pays for RC auto, the current account and electricity against
 * what others pay, from public data (lib/finance/tariff-data.ts). Averages, not quotes: they say
 * whether it's worth looking for a better price, not which one to take.
 */

const DAY_MS = 86_400_000;
const cents = (n: number) => Math.round(n * 100) / 100;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const daysBetween = (from: string, to: string) => Math.round((toTime(to) - toTime(from)) / DAY_MS);

export const TARIFF_KINDS = ["CAR_INSURANCE", "BANK_ACCOUNT", "ELECTRICITY"] as const;
export type TariffKind = (typeof TARIFF_KINDS)[number];

/** Within 10% of the reference it's in line: public averages aren't more precise than that. */
export const TOLERANCE = 0.1;

export type Verdict = "above" | "inline" | "below";

export function verdictFor(value: number, reference: number): Verdict {
  if (value > reference * (1 + TOLERANCE)) return "above";
  if (value < reference * (1 - TOLERANCE)) return "below";
  return "inline";
}

/**
 * The share of people (0–100) who pay less than `value`, read from a few known percentiles with
 * a straight line between them. Past the first or the last one it stays there.
 */
export function shareBelow(value: number, percentiles: Percentiles): number {
  const points = Object.entries(percentiles)
    .filter((e): e is [string, number] => typeof e[1] === "number")
    .map(([p, v]) => [Number(p), v] as const)
    .sort((a, b) => a[0] - b[0]);
  if (points.length === 0) return 50;
  if (value <= points[0][1]) return points[0][0];
  for (let i = 1; i < points.length; i++) {
    const [p0, v0] = points[i - 1];
    const [p1, v1] = points[i];
    if (value <= v1) return v1 === v0 ? p1 : p0 + ((value - v0) / (v1 - v0)) * (p1 - p0);
  }
  return points[points.length - 1][0];
}

/** "Paghi più di 8 automobilisti su 10", "Paghi meno di 7 correntisti su 10". */
export function positionText(share: number, people: string) {
  const outOfTen = (n: number) => Math.min(9, Math.max(1, Math.floor(n / 10)));
  return share >= 50
    ? `Paghi più di ${outOfTen(share)} ${people} su 10`
    : `Paghi meno di ${outOfTen(100 - share)} ${people} su 10`;
}

// ---------- Where the space lives ----------

export const PROVINCE_OPTIONS = Object.entries(CAR_PROVINCES)
  .map(([code, p]) => ({ code, name: p.name }))
  .sort((a, b) => a.name.localeCompare(b.name, "it"));

export const isProvince = (code: unknown): code is string =>
  typeof code === "string" && Object.hasOwn(CAR_PROVINCES, code);

// ---------- RC auto ----------

export type CarContext = { reason: "class" | "age"; group: string; average: number };

/**
 * Why a premium above the province's average can be expected: most policies are in class 1
 * and held by people over 35, so a worse class or a young driver pay more anywhere.
 */
export function carContext(bonusMalus: number | null, ageBand: AgeBand | null): CarContext[] {
  const notes: CarContext[] = [];
  const { byClass, byAge } = CAR_INSURANCE;
  if (bonusMalus !== null && bonusMalus > 1) {
    const group = bonusMalus <= 3 ? "2-3" : bonusMalus <= 10 ? "4-10" : "11-18";
    notes.push({ reason: "class", group, average: byClass[group] });
  }
  if (ageBand === "fino-24" || ageBand === "25-34") {
    notes.push({ reason: "age", group: ageBand, average: byAge[ageBand] });
  }
  return notes;
}

export type CarComparison = {
  province: string;
  provinceName: string;
  mean: number;
  percentiles: Percentiles;
  verdict: Verdict;
  share: number;
  /** How much more than the province's average, a year (0 when below it). */
  over: number;
  context: CarContext[];
};

/** The premium against the province's average; null until the province is known. */
export function compareCar(input: {
  premium: number;
  province: string | null;
  bonusMalus: number | null;
  ageBand: AgeBand | null;
}): CarComparison | null {
  const prices = input.province ? CAR_PROVINCES[input.province] : undefined;
  if (!input.province || !prices) return null;
  const percentiles: Percentiles = Object.fromEntries(
    CAR_PROVINCE_PERCENTILES.map((p, i) => [p, prices.p[i]]),
  );
  return {
    province: input.province,
    provinceName: prices.name,
    mean: prices.mean,
    percentiles,
    verdict: verdictFor(input.premium, prices.mean),
    share: shareBelow(input.premium, percentiles),
    over: cents(Math.max(0, input.premium - prices.mean)),
    context: carContext(input.bonusMalus, input.ageBand),
  };
}

// ---------- The current account ----------

const STAMP_DUTY = /imposta di bollo|\bbollo\b/i;

export type AccountMovement = {
  date: string;
  description: string;
  amount: number;
  category: string | null;
};

/** With fewer complete months of movements than this, the year isn't worth estimating. */
export const MIN_MONTHS_FOR_FEES = 3;

/**
 * What an account cost in a year, from its movements: the bank's fees, and the stamp duty apart
 * (it's a tax, the same in every bank). Whole months only, as in "Soldi ritrovati".
 */
export function accountCosts(
  movements: AccountMovement[],
  today: string,
  trackedSince: string | null,
) {
  const charges = movements.filter((m) => looksLikeBankFee(m.description, m.category));
  const isDuty = (m: AccountMovement) => STAMP_DUTY.test(m.description);
  const fees = yearlyFromMonths(
    charges.filter((m) => !isDuty(m)),
    today,
    trackedSince,
  );
  const duty = yearlyFromMonths(charges.filter(isDuty), today, trackedSince);
  return {
    yearly: fees?.yearly ?? 0,
    stampDuty: duty?.yearly ?? 0,
    count: fees?.counted.length ?? 0,
    /** Complete months behind the figure: below 12 it's an estimate, below 3 it's not given. */
    months: fees?.months ?? 0,
  };
}

export type BankComparison = {
  kind: BankAccountKind;
  mean: number;
  percentiles: Percentiles;
  verdict: Verdict;
  share: number;
  over: number;
  /** What the same year would cost less with an online account, on average. */
  overOnline: number;
};

export function compareBankAccount(yearly: number, kind: BankAccountKind): BankComparison {
  const ref = BANK_ACCOUNTS.kinds[kind];
  return {
    kind,
    mean: ref.mean,
    percentiles: ref.p,
    verdict: verdictFor(yearly, ref.mean),
    share: shareBelow(yearly, ref.p),
    over: cents(Math.max(0, yearly - ref.mean)),
    overOnline: cents(Math.max(0, yearly - BANK_ACCOUNTS.kinds.online.mean)),
  };
}

// ---------- Electricity ----------

/**
 * ARERA's reference price over a period, weighted by the days of each quarter. Null when part of
 * the period falls outside the quarters on file.
 */
export function referencePrice(from: string, to: string): number | null {
  let weighted = 0;
  let days = 0;
  for (const q of ELECTRICITY.quarters) {
    const start = from > q.from ? from : q.from;
    const end = to < q.to ? to : q.to;
    if (start > end) continue;
    const n = daysBetween(start, end) + 1;
    weighted += q.price * n;
    days += n;
  }
  const total = daysBetween(from, to) + 1;
  return days === total && total > 0 ? Math.round((weighted / days) * 10000) / 10000 : null;
}

export type ElectricityComparison = {
  /** € per kWh, everything on the bill included. */
  price: number;
  days: number;
  /** The bill's kWh stretched to a year. */
  yearlyKwh: number;
  yearlyCost: number;
  reference: number | null;
  verdict: Verdict | null;
  /** At the bill's price, how much more than the reference in a year (0 when below it). */
  over: number;
  /**
   * Far from the 2,000 kWh of the reference the comparison is rougher: the fixed costs weigh
   * more on each kWh for who uses little, less for who uses a lot.
   */
  consumption: "low" | "typical" | "high";
};

export function compareElectricity(bill: {
  amount: number;
  kwh: number;
  from: string;
  to: string;
}): ElectricityComparison {
  const days = daysBetween(bill.from, bill.to) + 1;
  const price = Math.round((bill.amount / bill.kwh) * 10000) / 10000;
  const yearlyKwh = Math.round((bill.kwh * 365) / days);
  const reference = referencePrice(bill.from, bill.to);
  return {
    price,
    days,
    yearlyKwh,
    yearlyCost: cents((bill.amount * 365) / days),
    reference,
    verdict: reference === null ? null : verdictFor(price, reference),
    over: reference === null ? 0 : cents(Math.max(0, (price - reference) * yearlyKwh)),
    consumption: yearlyKwh < 1500 ? "low" : yearlyKwh > 3000 ? "high" : "typical",
  };
}

// ---------- Reminders ----------

export type TariffReminder = {
  id: string;
  kind: TariffKind;
  label: string;
  date: string;
  days: number;
};

/**
 * RC auto policies ending and fixed electricity prices running out within a month: the moment
 * to compare, since neither renews at the same price by itself.
 */
export function upcomingRenewals(
  checks: { id: string; kind: TariffKind; label: string; renewsOn: string | null }[],
  today: string,
  within = 30,
): TariffReminder[] {
  return checks
    .filter((c): c is typeof c & { renewsOn: string } => c.renewsOn !== null)
    .map((c) => ({
      id: c.id,
      kind: c.kind,
      label: c.label,
      date: c.renewsOn,
      days: daysBetween(today, c.renewsOn),
    }))
    .filter((r) => r.days >= 0 && r.days <= within)
    .sort((a, b) => a.days - b.days);
}
