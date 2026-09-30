import { formatWorkTime, type WorkRate } from "@/lib/finance/work-time";
import type { ForecastEvent } from "@/lib/finance/forecast";

/*
 * "Can I afford it?": a purchase checked against the balance forecast, the savings pace, the
 * goals, the category budget and the working time it costs, with the best day to buy it.
 */

export type AffordInput = {
  amount: number;
  /** Charged every month (a subscription, an instalment) instead of once. */
  monthly: boolean;
  /** Everyday accounts' forecast, from today. */
  points: { date: string; balance: number }[];
  events: ForecastEvent[];
  dailySpend: number;
  savingsBalance: number;
  /** Average monthly income minus expenses. */
  monthlySaved: number;
  goals: { name: string; remaining: number }[];
  budget: { name: string; amount: number; spent: number } | null;
  workRate: WorkRate | null;
};

export type AffordVerdict = "yes" | "tight" | "savings" | "no";

export type AffordReason = { kind: "good" | "warn" | "bad" | "info"; text: string };

export type AffordResult = {
  verdict: AffordVerdict;
  title: string;
  reasons: AffordReason[];
  low: { date: string; balance: number };
  /** The first day from which buying keeps the balance above the safety margin. */
  bestDate: string | null;
  buffer: number;
  series: { date: string; balance: number; after: number }[];
};

const TITLES: Record<AffordVerdict, string> = {
  yes: "Sì, puoi permettertelo",
  tight: "Sì, ma con giudizio",
  savings: "Solo pescando dai risparmi",
  no: "Meglio di no, per ora",
};

const longDate = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
export const formatLongDate = (iso: string) => longDate.format(new Date(`${iso}T00:00:00Z`));

const sameDayNextMonths = (start: string, until: string) => {
  const [y, m, d] = start.split("-").map(Number);
  const dates: string[] = [];
  for (let i = 0; ; i++) {
    const last = new Date(Date.UTC(y, m - 1 + i + 1, 0)).getUTCDate();
    const iso = new Date(Date.UTC(y, m - 1 + i, Math.min(d, last))).toISOString().slice(0, 10);
    if (iso > until) return dates;
    dates.push(iso);
  }
};

export function checkAffordability(
  input: AffordInput,
  money: (value: number) => string,
): AffordResult | null {
  const { amount, points } = input;
  if (!(amount > 0) || points.length === 0) return null;

  // Never less than a week of the usual spending, and never a silly few euros.
  const buffer = Math.max(50, input.dailySpend * 7);
  const charges = input.monthly
    ? sameDayNextMonths(points[0].date, points[points.length - 1].date)
    : [points[0].date];
  const series = points.map((p) => {
    const paid = charges.filter((c) => c <= p.date).length * amount;
    return { date: p.date, balance: p.balance, after: p.balance - paid };
  });
  const low = series.reduce(
    (min, p) => (p.after < min.balance ? { date: p.date, balance: p.after } : min),
    { date: series[0].date, balance: series[0].after },
  );

  let verdict: AffordVerdict;
  if (low.balance < 0) verdict = input.savingsBalance >= -low.balance ? "savings" : "no";
  else if (input.monthly && amount > Math.max(0, input.monthlySaved)) verdict = "no";
  else if (low.balance < buffer) verdict = "tight";
  else if (input.monthly && amount > input.monthlySaved * 0.5) verdict = "tight";
  else if (!input.monthly && input.monthlySaved > 0 && amount > input.monthlySaved * 2)
    verdict = "tight";
  else verdict = "yes";

  const reasons: AffordReason[] = [];
  const end = series[series.length - 1].after;

  reasons.push({
    kind: low.balance < 0 ? "bad" : low.balance < buffer ? "warn" : "good",
    text:
      low.balance < 0
        ? `${capitalize(formatLongDate(low.date))} i conti di tutti i giorni andrebbero a ${money(low.balance)}.`
        : `Il punto più basso nei prossimi ${series.length - 1} giorni sarebbe ${money(low.balance)} (${formatLongDate(low.date)}); alla fine ti resterebbero ${money(end)}.`,
  });

  if (verdict === "savings") {
    reasons.push({
      kind: "warn",
      text: `Per coprirlo dovresti spostare ${money(-low.balance)} dai risparmi (ne hai ${money(input.savingsBalance)}).`,
    });
  }

  // When is it safe? The first day after which the balance never dips below the margin.
  let bestDate: string | null = null;
  if (!input.monthly && verdict !== "yes") {
    const suffixMin: number[] = new Array(series.length);
    for (let i = series.length - 1; i >= 0; i--) {
      suffixMin[i] = Math.min(
        series[i].balance,
        i + 1 < series.length ? suffixMin[i + 1] : Infinity,
      );
    }
    const index = suffixMin.findIndex((min, i) => i > 0 && min - amount >= buffer);
    if (index > 0) {
      bestDate = series[index].date;
      const income = input.events
        .filter((e) => e.amount > 0 && e.date <= bestDate!)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      reasons.push({
        kind: "info",
        text: `Se aspetti ${formatLongDate(bestDate)}${income ? ` (dopo «${income.name}»)` : ""} resti sempre sopra il margine di sicurezza di ${money(buffer)}.`,
      });
    }
  }

  if (input.monthly) {
    if (input.monthlySaved > 0 && amount > input.monthlySaved) {
      reasons.push({
        kind: "bad",
        text: `Ogni mese spenderesti più di quanto riesci a mettere da parte (${money(input.monthlySaved)}).`,
      });
    }
    reasons.push({ kind: "info", text: `All'anno sono ${money(amount * 12)}.` });
  } else if (input.monthlySaved > 0 && amount > input.monthlySaved) {
    const months = amount / input.monthlySaved;
    reasons.push({
      kind: months > 3 ? "warn" : "info",
      text: `Vale ${months < 1.95 ? "più di un mese" : `circa ${Math.round(months)} mesi`} di risparmi.`,
    });
  }

  const goal = input.goals[0];
  if (goal && input.monthlySaved > 0) {
    if (input.monthly) {
      const left = input.monthlySaved - amount;
      reasons.push({
        kind: left > 0 ? "warn" : "bad",
        text:
          left > 0
            ? `«${goal.name}» arriverebbe ${monthsLabel(goal.remaining / left - goal.remaining / input.monthlySaved)} più tardi.`
            : `Non ti resterebbe niente per «${goal.name}».`,
      });
    } else {
      const days = Math.round((amount / input.monthlySaved) * 30.4);
      if (days >= 1) {
        reasons.push({
          kind: days > 60 ? "warn" : "info",
          text: `«${goal.name}» slitterebbe di ${days < 60 ? `circa ${days} ${days === 1 ? "giorno" : "giorni"}` : monthsLabel(days / 30.4)}.`,
        });
      }
    }
  }

  if (input.budget) {
    const left = input.budget.amount - input.budget.spent - amount;
    reasons.push({
      kind: left < 0 ? "warn" : "info",
      text:
        left < 0
          ? `Sforeresti il budget «${input.budget.name}» di ${money(-left)} questo mese.`
          : `Nel budget «${input.budget.name}» ti resterebbero ${money(left)} questo mese.`,
    });
  }

  if (input.workRate) {
    reasons.push({
      kind: "info",
      text: `Ti costa ${formatWorkTime(amount, input.workRate)} di lavoro${input.monthly ? " al mese" : ""}.`,
    });
  }

  return { verdict, title: TITLES[verdict], reasons, low, bestDate, buffer, series };
}

function monthsLabel(months: number) {
  const m = Math.max(1, Math.round(months));
  return m === 1 ? "circa un mese" : `circa ${m} mesi`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
