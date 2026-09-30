import { nextOccurrence, type Frequency } from "@/lib/finance/recurring";

/*
 * Where the everyday accounts are heading: today's balance, plus the recurring income and bills
 * on the days they're expected, minus the usual day-to-day spending.
 */

export type ForecastRecurring = {
  name: string;
  type: "INCOME" | "EXPENSE";
  /** Expected amount, in the space currency. */
  amount: number;
  nextDate: string;
  frequency: Frequency;
};

export type ForecastEvent = { date: string; name: string; amount: number };

export type Forecast = {
  points: { date: string; balance: number }[];
  /** Recurring movements in the period, signed (income positive), by date. */
  events: ForecastEvent[];
  low: { date: string; balance: number };
  end: number;
};

const DAY_MS = 86_400_000;
const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** A salary or bill expected a few days ago but not recorded yet is still coming. */
const LATE_GRACE_DAYS = 5;

export function forecastBalance(input: {
  today: string;
  start: number;
  days: number;
  /** Average spending per day outside the recurring movements. */
  dailySpend: number;
  recurring: ForecastRecurring[];
}): Forecast {
  const last = addDays(input.today, input.days);
  const graceStart = addDays(input.today, -LATE_GRACE_DAYS);

  const events: ForecastEvent[] = [];
  for (const r of input.recurring) {
    let date = r.nextDate;
    while (date < graceStart) date = nextOccurrence(date, r.frequency);
    if (date < input.today) date = input.today;
    for (; date <= last; date = nextOccurrence(date, r.frequency)) {
      events.push({ date, name: r.name, amount: r.type === "INCOME" ? r.amount : -r.amount });
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);

  const byDay = new Map<string, number>();
  for (const e of events) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.amount);

  const points: Forecast["points"] = [];
  let balance = input.start;
  let low = { date: input.today, balance };
  for (let i = 0; i <= input.days; i++) {
    const date = addDays(input.today, i);
    // Today's spending has partly happened already: count it from tomorrow.
    balance += (byDay.get(date) ?? 0) - (i === 0 ? 0 : input.dailySpend);
    const rounded = Math.round(balance * 100) / 100;
    points.push({ date, balance: rounded });
    if (rounded < low.balance) low = { date, balance: rounded };
  }

  return { points, events, low, end: points[points.length - 1].balance };
}
