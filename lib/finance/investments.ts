/**
 * Investments, kept apart from the money you can spend. For each investment account:
 *
 * - invested: what was put in, i.e. the opening balance plus transfers in, minus transfers out;
 * - value: what it's worth, from the values entered by hand (what the bank or broker shows).
 *   After the last value, the movements recorded on the account add up at face value;
 * - gain: value minus invested. Dividends and fees recorded on the account (income and
 *   expenses) are part of it, since they aren't money put in or taken out.
 *
 * A value entered for a day includes that day's movements.
 */

export type InvestmentMovement = {
  /** YYYY-MM-DD */
  date: string;
  /** Into the account when positive, in the account's currency. */
  amount: number;
  /** Transfers put money in or take it out; income and expenses on the account are returns. */
  kind: "contribution" | "return";
};

export type Valuation = { date: string; value: number };

export type InvestmentPosition = {
  invested: number;
  value: number;
  gain: number;
  /** Gain over the money put in; null when nothing was put in. */
  gainPct: number | null;
  /** Day of the last value entered, null if it was never entered. */
  valuedAt: string | null;
};

const round = (n: number) => Math.round(n * 100) / 100;
const sum = (items: { amount: number }[]) => items.reduce((s, m) => s + m.amount, 0);

export function investmentPosition(
  opening: number,
  movements: InvestmentMovement[],
  valuations: Valuation[],
): InvestmentPosition {
  const invested = opening + sum(movements.filter((m) => m.kind === "contribution"));
  const last = [...valuations].sort((a, b) => b.date.localeCompare(a.date))[0];
  const value = last
    ? last.value + sum(movements.filter((m) => m.date > last.date))
    : opening + sum(movements);
  const gain = value - invested;
  return {
    invested: round(invested),
    value: round(value),
    gain: round(gain),
    gainPct: invested > 0 ? gain / invested : null,
    valuedAt: last?.date ?? null,
  };
}

export type SeriesPoint = { date: string; invested: number; value: number };

const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Day by day from `start` to `end`: what had been put in, and what it was worth. The market's path
 * between two values isn't known, so the part of the value that isn't movements moves in a
 * straight line from one value to the next (from zero on the first day, before the first value)
 * and stays put after the last one. Every day is there: see `downsample` for charts.
 */
export function investmentSeries(
  opening: number,
  movements: InvestmentMovement[],
  valuations: Valuation[],
  start: string,
  end: string,
): SeriesPoint[] {
  const sorted = [...movements].sort((a, b) => a.date.localeCompare(b.date));
  const marks = [...valuations].sort((a, b) => a.date.localeCompare(b.date));
  const days: string[] = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += DAY_MS) {
    days.push(iso(new Date(t)));
  }
  if (days.length === 0) return [];

  // Running totals of all movements (book) and of contributions only (invested), day by day.
  const book = new Map<string, number>();
  const invested = new Map<string, number>();
  let b = opening;
  let inv = opening;
  let i = 0;
  for (; i < sorted.length && sorted[i].date < days[0]; i++) {
    b += sorted[i].amount;
    if (sorted[i].kind === "contribution") inv += sorted[i].amount;
  }
  for (const day of days) {
    for (; i < sorted.length && sorted[i].date === day; i++) {
      b += sorted[i].amount;
      if (sorted[i].kind === "contribution") inv += sorted[i].amount;
    }
    book.set(day, b);
    invested.set(day, inv);
  }
  const bookAt = (date: string) => {
    if (book.has(date)) return book.get(date)!;
    // A value outside the range: count the movements up to that day.
    return opening + sum(sorted.filter((m) => m.date <= date));
  };

  // The part of each recorded value that isn't explained by movements.
  const anchors = marks.map((m) => ({
    t: Date.parse(`${m.date}T00:00:00Z`),
    u: m.value - bookAt(m.date),
  }));
  const startT = Date.parse(`${days[0]}T00:00:00Z`);
  const unexplained = (t: number) => {
    if (anchors.length === 0) return 0;
    const next = anchors.findIndex((a) => a.t >= t);
    if (next === -1) return anchors[anchors.length - 1].u;
    const after = anchors[next];
    if (after.t === t) return after.u;
    const before = next > 0 ? anchors[next - 1] : { t: Math.min(startT, after.t), u: 0 };
    if (after.t === before.t) return after.u;
    return before.u + ((after.u - before.u) * (t - before.t)) / (after.t - before.t);
  };

  return days.map((day) => ({
    date: day,
    invested: round(invested.get(day)!),
    value: round(book.get(day)! + unexplained(Date.parse(`${day}T00:00:00Z`))),
  }));
}

/** At most `maxPoints` evenly spaced points, always keeping the last one. */
export function downsample<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const sampled = points.filter((_, idx) => idx % step === 0);
  if (sampled[sampled.length - 1] !== points[points.length - 1]) sampled.push(points.at(-1)!);
  return sampled;
}

/**
 * Adds up several series (in the same currency) day by day. A series that starts later counts
 * as zero before its first day.
 */
export function sumSeries(series: SeriesPoint[][]): SeriesPoint[] {
  const totals = new Map<string, { invested: number; value: number }>();
  for (const list of series) {
    for (const point of list) {
      const entry = totals.get(point.date) ?? { invested: 0, value: 0 };
      entry.invested += point.invested;
      entry.value += point.value;
      totals.set(point.date, entry);
    }
  }
  return Array.from(totals.entries())
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([date, t]) => ({ date, invested: round(t.invested), value: round(t.value) }));
}
