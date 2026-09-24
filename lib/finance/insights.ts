import { formatCurrency } from "@/lib/format";

export type InsightTone = "positive" | "negative" | "neutral";
export type InsightKind =
  | "category-up"
  | "category-down"
  | "category-new"
  | "pace"
  | "savings"
  | "merchant"
  | "weekend"
  | "no-spend"
  | "price-up";

export type Insight = {
  id: string;
  kind: InsightKind;
  tone: InsightTone;
  text: string;
  /** Category identity for the icon, when the insight is about one category. */
  category?: { name: string; icon: string | null; color: string | null };
};

export type CategoryTotal = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  amount: number;
};

export type InsightInput = {
  monthName: string;
  previousMonthName: string;
  /** Top-level expense categories, month to date. */
  categoriesNow: CategoryTotal[];
  /** Same categories over the same days of the previous month. */
  categoriesPrevious: CategoryTotal[];
  spentNow: number;
  spentPrevious: number;
  lastMonth: { name: string; income: number; expense: number };
  topMerchant: { name: string; count: number; amount: number } | null;
  weekdayAverage: number;
  weekendAverage: number;
  noSpendDays: number;
  /** Active subscriptions whose latest charge went up. */
  priceIncreases?: { name: string; from: number; to: number; pct: number }[];
};

const MIN_CHANGE_PCT = 20;
const MIN_CHANGE_EUR = 20;

const pct = (n: number) => `${Math.round(Math.abs(n))}%`;

/** Numbers read with a leading vowel (uno, otto, undici, ottanta…) take the elided article. */
const startsWithVowelSound = (n: number) => {
  const r = Math.round(Math.abs(n));
  return r === 1 || r === 11 || String(r).startsWith("8");
};
/** "il 23%" / "l'11%" */
export const ilPct = (n: number) => (startsWithVowelSound(n) ? `l'${pct(n)}` : `il ${pct(n)}`);
/** "al 23%" / "all'11%" */
export const alPct = (n: number) => (startsWithVowelSound(n) ? `all'${pct(n)}` : `al ${pct(n)}`);
/** "del 23%" / "dell'11%" */
export const delPct = (n: number) => (startsWithVowelSound(n) ? `dell'${pct(n)}` : `del ${pct(n)}`);

/** Italian "a"/"ad" before a month name: "ad agosto", "a settembre". */
export const inMonth = (month: string) => (/^a/i.test(month) ? `ad ${month}` : `a ${month}`);

export function generateInsights(input: InsightInput): Insight[] {
  const insights: (Insight & { score: number })[] = [];
  const since = `rispetto allo stesso periodo di ${input.previousMonthName}`;

  if (input.spentPrevious > 0) {
    const change = ((input.spentNow - input.spentPrevious) / input.spentPrevious) * 100;
    const base = `Finora ${inMonth(input.monthName)} hai speso ${formatCurrency(input.spentNow)}`;
    insights.push({
      id: "pace",
      kind: "pace",
      tone: change <= -5 ? "positive" : change >= 5 ? "negative" : "neutral",
      text:
        Math.abs(change) < 5
          ? `${base}, in linea con lo stesso periodo di ${input.previousMonthName}.`
          : `${base}, ${ilPct(change)} in ${change > 0 ? "più" : "meno"} ${since}.`,
      score: 1000,
    });
  }

  const previousById = new Map(input.categoriesPrevious.map((c) => [c.id, c.amount]));
  const changes = input.categoriesNow
    .map((c) => ({ ...c, previous: previousById.get(c.id) ?? 0 }))
    .concat(
      input.categoriesPrevious
        .filter((p) => !input.categoriesNow.some((c) => c.id === p.id))
        .map((p) => ({ ...p, amount: 0, previous: p.amount })),
    )
    .map((c) => ({ ...c, delta: c.amount - c.previous }));

  const increases = changes
    .filter(
      (c) =>
        c.delta >= MIN_CHANGE_EUR &&
        (c.previous === 0 || (c.delta / c.previous) * 100 >= MIN_CHANGE_PCT),
    )
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 2);
  for (const c of increases) {
    const category = { name: c.name, icon: c.icon, color: c.color };
    insights.push(
      c.previous === 0
        ? {
            id: `new-${c.id}`,
            kind: "category-new",
            tone: "neutral",
            text: `Questo mese hai speso ${formatCurrency(c.amount)} in ${c.name}, che nello stesso periodo di ${input.previousMonthName} era a zero.`,
            category,
            score: 650 + c.delta,
          }
        : {
            id: `up-${c.id}`,
            kind: "category-up",
            tone: "negative",
            text: `In ${c.name} hai speso ${ilPct((c.delta / c.previous) * 100)} in più ${since} (+${formatCurrency(c.delta)}).`,
            category,
            score: 700 + c.delta,
          },
    );
  }

  const decrease = changes
    .filter(
      (c) =>
        c.previous > 0 &&
        -c.delta >= MIN_CHANGE_EUR &&
        (-c.delta / c.previous) * 100 >= MIN_CHANGE_PCT,
    )
    .sort((a, b) => a.delta - b.delta)[0];
  if (decrease) {
    insights.push({
      id: `down-${decrease.id}`,
      kind: "category-down",
      tone: "positive",
      text: `Bene su ${decrease.name}: ${ilPct((decrease.delta / decrease.previous) * 100)} in meno ${since} (${formatCurrency(-decrease.delta)} risparmiati).`,
      category: { name: decrease.name, icon: decrease.icon, color: decrease.color },
      score: 600 - decrease.delta,
    });
  }

  const { income, expense, name } = input.lastMonth;
  if (income > 0) {
    const saved = income - expense;
    const rate = (saved / income) * 100;
    insights.push({
      id: "savings",
      kind: "savings",
      tone: rate >= 20 ? "positive" : rate < 0 ? "negative" : "neutral",
      text:
        saved < 0
          ? `${capitalize(inMonth(name))} hai speso ${formatCurrency(-saved)} più di quanto è entrato.`
          : `${capitalize(inMonth(name))} hai messo da parte ${ilPct(rate)} delle entrate (${formatCurrency(saved)})${rate >= 20 ? ": ottimo lavoro." : "."}`,
      score: 500,
    });
  }

  if (input.topMerchant && input.topMerchant.count >= 4) {
    const m = input.topMerchant;
    insights.push({
      id: "merchant",
      kind: "merchant",
      tone: "neutral",
      text: `Il posto dove spendi più spesso questo mese è ${m.name}: ${m.count} volte, per ${formatCurrency(m.amount)} in totale.`,
      score: 120,
    });
  }

  if (input.weekdayAverage > 0 && input.weekendAverage >= input.weekdayAverage * 1.3) {
    const extra = ((input.weekendAverage - input.weekdayAverage) / input.weekdayAverage) * 100;
    insights.push({
      id: "weekend",
      kind: "weekend",
      tone: "neutral",
      text: `Nel weekend spendi in media ${formatCurrency(input.weekendAverage)} al giorno, ${ilPct(extra)} in più che in settimana (${formatCurrency(input.weekdayAverage)}).`,
      score: 100,
    });
  }

  if (input.noSpendDays >= 3) {
    insights.push({
      id: "no-spend",
      kind: "no-spend",
      tone: "positive",
      text: `${capitalize(inMonth(input.monthName))} hai già ${input.noSpendDays} giorni senza nessuna spesa.`,
      score: 80,
    });
  }

  for (const p of input.priceIncreases ?? []) {
    insights.push({
      id: `price-${p.name}`,
      kind: "price-up",
      tone: "negative",
      text: `${p.name} è aumentato ${delPct(p.pct)}: da ${formatCurrency(p.from)} a ${formatCurrency(p.to)}. Vale ancora la pena?`,
      score: 900 + p.pct,
    });
  }

  return insights
    .sort((a, b) => b.score - a.score)
    .map((insight) => {
      const result: Insight & { score?: number } = { ...insight };
      delete result.score;
      return result;
    });
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
