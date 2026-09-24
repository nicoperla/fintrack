import type { Slice } from "@/lib/finance/dashboard-math";

// ---------- Cash flow (Sankey) ----------

export type FlowNodeKind = "income" | "deficit" | "hub" | "expense" | "savings";
export type FlowNode = { name: string; color: string | null; kind: FlowNodeKind; value: number };
export type FlowLink = { source: number; target: number; value: number };

/**
 * income sources → "Disponibile" → expense categories (+ "Risparmio").
 * When expenses exceed income, a "Prelevato dai risparmi" source balances the hub.
 */
export function buildCashFlow(income: Slice[], expenses: Slice[]) {
  const totalIncome = income.reduce((s, x) => s + x.value, 0);
  const totalExpense = expenses.reduce((s, x) => s + x.value, 0);
  const net = totalIncome - totalExpense;

  const nodes: FlowNode[] = [];
  const links: FlowLink[] = [];
  const sources: number[] = [];

  for (const s of income) {
    sources.push(nodes.push({ name: s.name, color: s.color, kind: "income", value: s.value }) - 1);
  }
  if (net < 0) {
    sources.push(
      nodes.push({ name: "Prelevato dai risparmi", color: null, kind: "deficit", value: -net }) - 1,
    );
  }
  const hub =
    nodes.push({
      name: "Disponibile",
      color: null,
      kind: "hub",
      value: Math.max(totalIncome, totalExpense),
    }) - 1;
  for (const index of sources)
    links.push({ source: index, target: hub, value: nodes[index].value });

  for (const s of expenses) {
    const index = nodes.push({ name: s.name, color: s.color, kind: "expense", value: s.value }) - 1;
    links.push({ source: hub, target: index, value: s.value });
  }
  if (net > 0) {
    const index = nodes.push({ name: "Risparmio", color: null, kind: "savings", value: net }) - 1;
    links.push({ source: hub, target: index, value: net });
  }

  return { nodes, links, totalIncome, totalExpense, net };
}

// ---------- Calendar heatmap ----------

export type HeatCell = {
  date: string;
  amount: number;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  /** Before the user started tracking: shown as "no data", excluded from stats. */
  beforeTracking: boolean;
};
export type DayTotal = { date: string; amount: number; count: number };

const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
/** Monday = 0 … Sunday = 6. */
export const weekdayIndex = (d: Date) => (d.getUTCDay() + 6) % 7;

function quantile(sorted: number[], q: number) {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * GitHub-style grid: one column per week (Monday first), ending with the week of `end`.
 * Levels 1-4 split the spending days into quartiles so a single big payment (rent) doesn't
 * flatten every other day into the lowest shade. Days before `trackingStart` count as "no data".
 */
export function buildHeatmap(days: DayTotal[], end: Date, weeks: number, trackingStart?: Date) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const firstDay = new Date(end.getTime() - (weekdayIndex(end) + (weeks - 1) * 7) * DAY_MS);

  const inRange: DayTotal[] = [];
  for (let t = firstDay.getTime(); t <= end.getTime(); t += DAY_MS) {
    const key = iso(new Date(t));
    inRange.push(byDate.get(key) ?? { date: key, amount: 0, count: 0 });
  }

  const trackingKey = trackingStart ? iso(trackingStart) : "";
  const tracked = inRange.filter((d) => d.date >= trackingKey);
  const positive = tracked
    .map((d) => d.amount)
    .filter((a) => a > 0)
    .sort((a, b) => a - b);
  const thresholds = [0.25, 0.5, 0.75].map((q) => quantile(positive, q));
  const levelOf = (amount: number): HeatCell["level"] => {
    if (amount <= 0) return 0;
    if (amount <= thresholds[0]) return 1;
    if (amount <= thresholds[1]) return 2;
    if (amount <= thresholds[2]) return 3;
    return 4;
  };

  const columns: (HeatCell | null)[][] = [];
  const months: { label: Date; column: number }[] = [];
  inRange.forEach((d, i) => {
    const column = Math.floor(i / 7);
    if (!columns[column]) columns[column] = Array(7).fill(null);
    columns[column][i % 7] = {
      ...d,
      level: levelOf(d.amount),
      beforeTracking: d.date < trackingKey,
    };
    const date = new Date(`${d.date}T00:00:00Z`);
    if (date.getUTCDate() === 1 || i === 0) months.push({ label: date, column });
  });
  // The very first label only stays if its month has room before the next one.
  if (months.length > 1 && months[1].column - months[0].column < 3) months.shift();

  const spendingDays = tracked.filter((d) => d.amount > 0);
  const total = spendingDays.reduce((s, d) => s + d.amount, 0);
  const maxDay = spendingDays.reduce<DayTotal | null>(
    (m, d) => (!m || d.amount > m.amount ? d : m),
    null,
  );

  return {
    columns,
    months,
    thresholds,
    stats: {
      total,
      days: tracked.length,
      noSpendDays: tracked.length - spendingDays.length,
      averagePerDay: tracked.length ? total / tracked.length : 0,
      maxDay,
    },
  };
}

// ---------- Net worth over time ----------

export type DailyNet = { date: string; net: number };

/**
 * Net worth at the end of each day from `start` to `end`: the sum of opening balances plus every
 * income minus every expense up to that day (transfers move money between accounts and cancel out).
 * Downsampled to at most `maxPoints`, always keeping the last day.
 */
export function netWorthSeries(
  openingTotal: number,
  flows: DailyNet[],
  start: Date,
  end: Date,
  maxPoints = 120,
) {
  const sorted = [...flows].sort((a, b) => a.date.localeCompare(b.date));
  const startKey = iso(start);
  let running = openingTotal;
  let i = 0;
  for (; i < sorted.length && sorted[i].date < startKey; i++) running += sorted[i].net;

  const points: { date: string; value: number }[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const key = iso(new Date(t));
    for (; i < sorted.length && sorted[i].date === key; i++) running += sorted[i].net;
    points.push({ date: key, value: Math.round(running * 100) / 100 });
  }

  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const sampled = points.filter((_, idx) => idx % step === 0);
  if (sampled[sampled.length - 1] !== points[points.length - 1])
    sampled.push(points[points.length - 1]);
  return sampled;
}
