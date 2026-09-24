export type RecurringInputTx = {
  date: string;
  amount: number;
  description: string;
  type: "INCOME" | "EXPENSE";
  categoryId: string | null;
};

export type Frequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";

const FREQUENCIES: { key: Frequency; days: number; tolerance: number; label: string }[] = [
  { key: "weekly", days: 7, tolerance: 2, label: "Ogni settimana" },
  { key: "biweekly", days: 14, tolerance: 3, label: "Ogni due settimane" },
  { key: "monthly", days: 30.44, tolerance: 4, label: "Ogni mese" },
  { key: "quarterly", days: 91.3, tolerance: 10, label: "Ogni trimestre" },
  { key: "yearly", days: 365.25, tolerance: 20, label: "Ogni anno" },
];

export const FREQUENCY_LABELS = Object.fromEntries(
  FREQUENCIES.map((f) => [f.key, f.label]),
) as Record<Frequency, string>;

export type Recurring = {
  key: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  categoryId: string | null;
  frequency: Frequency;
  occurrences: number;
  averageAmount: number;
  lastAmount: number;
  lastDate: string;
  nextDate: string;
  /** Bills vary month to month; subscriptions don't. */
  variableAmount: boolean;
  active: boolean;
  monthlyCost: number;
  priceChange: { from: number; to: number; pct: number } | null;
};

const NOISE = new Set([
  "pagamento",
  "addebito",
  "addebiti",
  "sdd",
  "pos",
  "carta",
  "bonifico",
  "a",
  "da",
  "di",
  "del",
  "per",
  "rif",
  "n",
  "srl",
  "spa",
]);

/** "PAGAMENTO POS NETFLIX.COM 12/09" → "netflix com": stable across months and bank formats. */
export function normalizeDescription(description: string) {
  return description
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\d+/g, " ")
    .replace(/[^a-z]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 1 && !NOISE.has(w))
    .join(" ")
    .trim();
}

const DAY_MS = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function coefficientOfVariation(values: number[]) {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function addMonths(iso: string, months: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return toIso(target.getTime());
}

const MIN_OCCURRENCES = 3;
const FIXED_TOLERANCE = 0.05;
const MAX_VARIABLE_CV = 0.35;
const PRICE_CHANGE_MIN = 0.02;

/**
 * Finds series of transactions with the same (normalized) description that repeat at a regular
 * interval with a stable amount. Transfers must be excluded by the caller.
 */
export function detectRecurring(transactions: RecurringInputTx[], today: string): Recurring[] {
  const groups = new Map<string, RecurringInputTx[]>();
  for (const tx of transactions) {
    const normalized = normalizeDescription(tx.description);
    if (!normalized) continue;
    const key = `${tx.type}|${normalized}`;
    groups.set(key, [...(groups.get(key) ?? []), tx]);
  }

  const results: Recurring[] = [];
  groups.forEach((items, key) => {
    if (items.length < MIN_OCCURRENCES) return;
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));

    const intervals = sorted
      .slice(1)
      .map((tx, i) => (toTime(tx.date) - toTime(sorted[i].date)) / DAY_MS);
    if (intervals.some((d) => d === 0)) return; // several on the same day: not a subscription
    const typical = median(intervals);
    const frequency = FREQUENCIES.find((f) => Math.abs(typical - f.days) <= f.tolerance);
    if (!frequency) return;
    const regular = intervals.filter((d) => Math.abs(d - frequency.days) <= frequency.tolerance);
    if (regular.length / intervals.length < 0.75) return;

    const amounts = sorted.map((t) => t.amount);
    const last = amounts[amounts.length - 1];
    const previous = amounts.slice(0, -1);
    const previousMedian = median(previous);
    const previousStable = previous.every(
      (a) => Math.abs(a - previousMedian) <= previousMedian * FIXED_TOLERANCE,
    );
    const priceChange =
      previousStable && last > previousMedian * (1 + PRICE_CHANGE_MIN)
        ? { from: previousMedian, to: last, pct: ((last - previousMedian) / previousMedian) * 100 }
        : null;

    const allFixed = amounts.every(
      (a) => Math.abs(a - median(amounts)) <= median(amounts) * FIXED_TOLERANCE,
    );
    const variableAmount = !allFixed && !priceChange;
    if (variableAmount && coefficientOfVariation(amounts) > MAX_VARIABLE_CV) return;

    const lastDate = sorted[sorted.length - 1].date;
    const nextDate =
      frequency.key === "monthly"
        ? addMonths(lastDate, 1)
        : frequency.key === "quarterly"
          ? addMonths(lastDate, 3)
          : frequency.key === "yearly"
            ? addMonths(lastDate, 12)
            : toIso(toTime(lastDate) + frequency.days * DAY_MS);

    const daysSinceLast = (toTime(today) - toTime(lastDate)) / DAY_MS;
    // The amount going forward: the new price if it changed, otherwise the typical one.
    const expected = priceChange
      ? last
      : variableAmount
        ? amounts.reduce((s, a) => s + a, 0) / amounts.length
        : median(amounts);

    const categoryCounts = new Map<string | null, number>();
    for (const t of sorted)
      categoryCounts.set(t.categoryId, (categoryCounts.get(t.categoryId) ?? 0) + 1);
    const categoryId = Array.from(categoryCounts).sort((a, b) => b[1] - a[1])[0][0];

    results.push({
      key,
      name: sorted[sorted.length - 1].description,
      type: sorted[0].type,
      categoryId,
      frequency: frequency.key,
      occurrences: sorted.length,
      averageAmount: Math.round(expected * 100) / 100,
      lastAmount: last,
      lastDate,
      nextDate,
      variableAmount,
      active: daysSinceLast <= frequency.days * 1.5 + frequency.tolerance,
      monthlyCost: Math.round(((expected * 30.44) / frequency.days) * 100) / 100,
      priceChange,
    });
  });

  return results.sort((a, b) => b.monthlyCost - a.monthlyCost);
}
