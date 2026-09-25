export type GamificationInput = {
  /** Distinct days ("YYYY-MM-DD", user's time zone) on which something was recorded. */
  activityDays: string[];
  today: string;
  transactionCount: number;
  importedCount: number;
  budgetCount: number;
  completedGoals: number;
  /** Complete months only. */
  months: { month: string; income: number; expense: number }[];
  /** Whether every budget stayed within its limit last month; null without budgets. */
  lastMonthWithinBudget: boolean | null;
};

export type BadgeId =
  | "first-step"
  | "week-streak"
  | "month-streak"
  | "hundred"
  | "planner"
  | "on-track"
  | "saver"
  | "goal"
  | "importer";

export type Badge = {
  id: BadgeId;
  name: string;
  description: string;
  unlocked: boolean;
  progress: { value: number; target: number } | null;
};

export const LEVELS = [
  { min: 0, name: "Principiante" },
  { min: 100, name: "Apprendista" },
  { min: 250, name: "Attento" },
  { min: 500, name: "Organizzato" },
  { min: 900, name: "Stratega" },
  { min: 1500, name: "Maestro del risparmio" },
  { min: 2500, name: "Leggenda" },
] as const;

const XP = { perTransaction: 2, transactionCap: 1000, perStreakDay: 5, perBadge: 50 };
const SAVER_RATE = 0.2;

const DAY_MS = 86_400_000;
const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

export function computeStreak(activityDays: string[], today: string) {
  const days = new Set(activityDays);
  const sorted = Array.from(days).sort();

  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of sorted) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  // A streak survives until the end of today: if yesterday was active, it's still alive.
  const activeToday = days.has(today);
  let cursor = activeToday ? today : addDays(today, -1);
  let current = 0;
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const recent = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(today, i - 13);
    return { date, active: days.has(date) };
  });

  return { current, longest, activeToday, recent };
}

export function levelFor(xp: number) {
  let index = 0;
  LEVELS.forEach((level, i) => {
    if (xp >= level.min) index = i;
  });
  const next = LEVELS[index + 1];
  const current = LEVELS[index];
  return {
    level: index + 1,
    name: current.name,
    xp,
    currentMin: current.min,
    nextMin: next?.min ?? null,
    nextName: next?.name ?? null,
    progress: next ? (xp - current.min) / (next.min - current.min) : 1,
  };
}

export function computeGamification(input: GamificationInput) {
  const streak = computeStreak(input.activityDays, input.today);
  const bestSavingsRate = Math.max(
    0,
    ...input.months.filter((m) => m.income > 0).map((m) => (m.income - m.expense) / m.income),
  );

  const badge = (
    id: BadgeId,
    name: string,
    description: string,
    value: number,
    target: number,
  ): Badge => ({
    id,
    name,
    description,
    unlocked: value >= target,
    progress: target > 1 ? { value: Math.min(value, target), target } : null,
  });

  const badges: Badge[] = [
    badge(
      "first-step",
      "Primo passo",
      "Registra il tuo primo movimento.",
      input.transactionCount,
      1,
    ),
    badge(
      "week-streak",
      "Settimana perfetta",
      "Registra qualcosa 7 giorni di fila.",
      streak.longest,
      7,
    ),
    badge("month-streak", "Un mese di fila", "Tieni la streak per 30 giorni.", streak.longest, 30),
    badge("hundred", "Cento movimenti", "Registra 100 movimenti.", input.transactionCount, 100),
    badge("planner", "Pianificatore", "Imposta il tuo primo budget.", input.budgetCount, 1),
    badge(
      "on-track",
      "Tutto sotto controllo",
      "Chiudi un mese con tutti i budget rispettati.",
      input.lastMonthWithinBudget ? 1 : 0,
      1,
    ),
    badge(
      "saver",
      "Risparmiatore",
      "Metti da parte almeno il 20% delle entrate in un mese.",
      bestSavingsRate >= SAVER_RATE ? 1 : 0,
      1,
    ),
    badge(
      "goal",
      "Traguardo raggiunto",
      "Completa un obiettivo di risparmio.",
      input.completedGoals,
      1,
    ),
    badge("importer", "Import lampo", "Importa un estratto conto CSV.", input.importedCount, 1),
  ];

  const unlocked = badges.filter((b) => b.unlocked).length;
  const xp =
    Math.min(input.transactionCount, XP.transactionCap) * XP.perTransaction +
    streak.longest * XP.perStreakDay +
    unlocked * XP.perBadge;

  return { streak, badges, unlocked, level: levelFor(xp) };
}

export type Gamification = ReturnType<typeof computeGamification>;
