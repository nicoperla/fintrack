import { splitShares, type SplitMode } from "@/lib/finance/split";

/*
 * "Il caffè dei conti": once a month the people sharing a space sit down for fifteen minutes.
 * FinTrack writes the agenda from the month's data: how the shared month went, who put in what,
 * the goals, one decision to take and one thing to celebrate. No judgement and no products:
 * questions to talk about, and the decisions they write down.
 */

const cents = (n: number) => Math.round(n * 100) / 100;

export const TALK_STEPS = ["month", "contributions", "goals", "decision", "win"] as const;
export type TalkStep = (typeof TALK_STEPS)[number];

/** A decision is one short sentence: "Spesa online una volta a settimana". */
export const DECISION_MAX = 140;
/** Open decisions a space can keep: enough for a year of talks, not a to-do app. */
export const OPEN_DECISIONS_LIMIT = 50;

export type TalkCategory = { id: string; name: string; icon: string | null; color: string | null };

export type TalkGoalInput = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  target: number;
  current: number;
  /** "YYYY-MM-DD", null when the goal has no date. */
  targetDate: string | null;
  /** What it takes each month from now to get there on time; null without a date or when reached. */
  monthly: number | null;
  overdue: boolean;
  /** Reached, and touched since the start of the month talked about: news to celebrate. */
  reachedLately: boolean;
};

export type TalkInput = {
  members: { userId: string; name: string; income: number | null }[];
  splitMode: SplitMode;
  /** The month's shared expenses (not tagged personal), with who recorded them. */
  expenses: { userId: string | null; amount: number; category: TalkCategory | null }[];
  /** The month before, shared expenses by top category; null when there is no data for it. */
  previous: { categories: (TalkCategory & { amount: number })[] } | null;
  /** Everything that came in and went out in the month, personal expenses included. */
  income: number;
  expense: number;
  /** Monthly budgets and what went into them in the month. */
  budgets: { name: string; amount: number; spent: number }[];
  goals: TalkGoalInput[];
  /** What it takes today to be even, from "Conti chiari". */
  transfers: { from: string; to: string; amount: number }[];
  /** Big expenses ("stangate") coming up in the next weeks, not paid yet. */
  upcoming: { name: string; amount: number; date: string }[];
  /** Active subscriptions with a fixed price. */
  subscriptions: { count: number; monthly: number };
  /** "Il Tariffometro": items costing more than the public reference, per year. */
  tariffs: { label: string; over: number }[];
  /** Decisions taken at the last talk, done or not. */
  lastDecisions: { done: boolean }[];
};

// ---------- The month ----------

export type MonthOverview = {
  shared: number;
  count: number;
  /** Change of the shared expenses against the month before, in percent; null without it. */
  change: number | null;
  categories: (TalkCategory & { amount: number; share: number })[];
  /** The category that moved the most against the month before. */
  mover: (TalkCategory & { delta: number }) | null;
};

const UNCATEGORIZED: TalkCategory = {
  id: "none",
  name: "Senza categoria",
  icon: null,
  color: null,
};

export function monthOverview(input: Pick<TalkInput, "expenses" | "previous">): MonthOverview {
  const byCategory = new Map<string, TalkCategory & { amount: number }>();
  for (const e of input.expenses) {
    const c = e.category ?? UNCATEGORIZED;
    const current = byCategory.get(c.id) ?? { ...c, amount: 0 };
    current.amount += e.amount;
    byCategory.set(c.id, current);
  }
  const shared = cents(input.expenses.reduce((s, e) => s + e.amount, 0));
  const ranked = Array.from(byCategory.values()).sort((a, b) => b.amount - a.amount);

  let change: number | null = null;
  let mover: MonthOverview["mover"] = null;
  if (input.previous) {
    const before = new Map(input.previous.categories.map((c) => [c.id, c]));
    const previousTotal = input.previous.categories.reduce((s, c) => s + c.amount, 0);
    if (previousTotal > 0) change = ((shared - previousTotal) / previousTotal) * 100;
    // Categories gone this month count too: "Viaggi −600 €" is news.
    const ids = Array.from(byCategory.keys()).concat(Array.from(before.keys()));
    for (const id of ids.filter((id, i) => ids.indexOf(id) === i)) {
      if (id === UNCATEGORIZED.id) continue;
      const now = byCategory.get(id);
      const then = before.get(id);
      const delta = cents((now?.amount ?? 0) - (then?.amount ?? 0));
      if (Math.abs(delta) < 30 || (mover && Math.abs(delta) <= Math.abs(mover.delta))) continue;
      const { name, icon, color } = (now ?? then)!;
      mover = { id, name, icon, color, delta };
    }
  }

  return {
    shared,
    count: input.expenses.length,
    change,
    categories: ranked.slice(0, 3).map((c) => ({
      ...c,
      amount: cents(c.amount),
      share: shared > 0 ? c.amount / shared : 0,
    })),
    mover,
  };
}

// ---------- Who put in what ----------

export type Contributions = {
  /** The rule applied: INCOME falls back to EQUAL when an income is missing. */
  mode: SplitMode;
  fallback: boolean;
  members: {
    userId: string;
    name: string;
    paid: number;
    /** Fraction of the month's shared expenses this member paid (0–1). */
    paidShare: number;
    /** Fraction the rule asks of them (0–1). */
    due: number;
  }[];
  /** Expenses recorded by people no longer in the space. */
  unattributed: number;
};

export function contributions(
  input: Pick<TalkInput, "members" | "splitMode" | "expenses">,
): Contributions {
  const { shares, mode, fallback } = splitShares(input.members, input.splitMode);
  const paid = new Map<string, number>();
  let unattributed = 0;
  for (const e of input.expenses) {
    if (e.userId && shares.has(e.userId)) {
      paid.set(e.userId, (paid.get(e.userId) ?? 0) + e.amount);
    } else unattributed += e.amount;
  }
  const total = Array.from(paid.values()).reduce((s, v) => s + v, 0);
  return {
    mode,
    fallback,
    members: input.members.map((m) => ({
      userId: m.userId,
      name: m.name,
      paid: cents(paid.get(m.userId) ?? 0),
      paidShare: total > 0 ? (paid.get(m.userId) ?? 0) / total : 0,
      due: shares.get(m.userId) ?? 0,
    })),
    unattributed: cents(unattributed),
  };
}

// ---------- Goals ----------

export type TalkGoal = TalkGoalInput & {
  progress: number;
  /** The monthly amount split by the space's rule: who puts in how much. */
  perMember: { name: string; amount: number }[];
};

/** The goals still open, nearest date first, with the monthly amount split between members. */
export function talkGoals(input: Pick<TalkInput, "goals" | "members" | "splitMode">): TalkGoal[] {
  const { shares } = splitShares(input.members, input.splitMode);
  return input.goals
    .filter((g) => g.current < g.target)
    .sort((a, b) => (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999"))
    .slice(0, 3)
    .map((g) => ({
      ...g,
      progress: g.target > 0 ? Math.min(1, g.current / g.target) : 0,
      perMember:
        g.monthly !== null && input.members.length >= 2
          ? input.members.map((m) => ({
              name: m.name,
              amount: Math.ceil(g.monthly! * (shares.get(m.userId) ?? 0)),
            }))
          : [],
    }));
}

// ---------- One decision ----------

/**
 * Questions worth a decision, from the data. `topic` is what the decision log shows next to the
 * decision: a name, never an amount (the log is read later, also with amounts hidden).
 */
export type Suggestion = { topic: string } & (
  | { kind: "budget"; name: string; over: number; amount: number }
  | { kind: "goal-overdue"; name: string; missing: number }
  | { kind: "goal-date"; name: string; monthly: number; until: string }
  | { kind: "no-goal" }
  | { kind: "big-expense"; name: string; amount: number; date: string }
  | { kind: "settle"; from: string; to: string; amount: number }
  | { kind: "tariff"; label: string; over: number }
  | { kind: "category-up"; name: string; delta: number }
  | { kind: "subscriptions"; count: number; monthly: number }
  | { kind: "next-month" }
);

/** At most three, the most pressing first; there is always at least one. */
export function suggestDecisions(input: TalkInput, overview: MonthOverview): Suggestion[] {
  const list: Suggestion[] = [];

  const overBudget = input.budgets
    .filter((b) => b.amount > 0 && b.spent > b.amount)
    .sort((a, b) => b.spent - b.amount - (a.spent - a.amount))[0];
  if (overBudget) {
    list.push({
      kind: "budget",
      topic: `Budget «${overBudget.name}»`,
      name: overBudget.name,
      over: cents(overBudget.spent - overBudget.amount),
      amount: overBudget.amount,
    });
  }

  const open = input.goals.filter((g) => g.current < g.target);
  const overdue = open.find((g) => g.overdue);
  const dated = open
    .filter((g) => g.monthly !== null && !g.overdue)
    .sort((a, b) => a.targetDate!.localeCompare(b.targetDate!))[0];
  if (overdue) {
    list.push({
      kind: "goal-overdue",
      topic: `Obiettivo «${overdue.name}»`,
      name: overdue.name,
      missing: cents(overdue.target - overdue.current),
    });
  } else if (dated) {
    list.push({
      kind: "goal-date",
      topic: `Obiettivo «${dated.name}»`,
      name: dated.name,
      monthly: Math.ceil(dated.monthly!),
      until: dated.targetDate!,
    });
  } else if (open.length === 0) {
    list.push({ kind: "no-goal", topic: "Un obiettivo comune" });
  }

  const big = [...input.upcoming].sort((a, b) => b.amount - a.amount)[0];
  if (big) {
    list.push({
      kind: "big-expense",
      topic: `Stangata «${big.name}»`,
      name: big.name,
      amount: big.amount,
      date: big.date,
    });
  }

  const owed = [...input.transfers].sort((a, b) => b.amount - a.amount)[0];
  if (owed && owed.amount >= 20) {
    list.push({ kind: "settle", topic: "Pareggio dei conti", ...owed });
  }

  const tariff = [...input.tariffs].sort((a, b) => b.over - a.over)[0];
  if (tariff) {
    list.push({ kind: "tariff", topic: tariff.label, label: tariff.label, over: tariff.over });
  }

  const mover = overview.mover;
  if (mover && mover.delta >= 50) {
    list.push({
      kind: "category-up",
      topic: mover.name,
      name: mover.name,
      delta: mover.delta,
    });
  }

  if (input.subscriptions.count >= 4) {
    list.push({ kind: "subscriptions", topic: "Abbonamenti", ...input.subscriptions });
  }

  if (list.length === 0) list.push({ kind: "next-month", topic: "Il mese prossimo" });
  return list.slice(0, 3);
}

// ---------- One thing to celebrate ----------

export type Win =
  | { kind: "goal-reached"; name: string }
  | { kind: "decisions-done"; done: number; total: number }
  | { kind: "spent-less"; pct: number }
  | { kind: "budgets-kept"; kept: number; total: number }
  | { kind: "saved"; rate: number; amount: number }
  | { kind: "even" }
  | { kind: "goal-halfway"; name: string; progress: number }
  | { kind: "showed-up" };

/** The best news first; at most three. "You sat down to talk" is always there to fall back on. */
export function findWins(input: TalkInput, overview: MonthOverview): Win[] {
  const wins: Win[] = [];

  const reached = input.goals.find((g) => g.current >= g.target && g.reachedLately);
  if (reached) wins.push({ kind: "goal-reached", name: reached.name });

  const done = input.lastDecisions.filter((d) => d.done).length;
  if (done > 0) wins.push({ kind: "decisions-done", done, total: input.lastDecisions.length });

  if (overview.change !== null && overview.change <= -5) {
    wins.push({ kind: "spent-less", pct: Math.round(-overview.change) });
  }

  const budgets = input.budgets.filter((b) => b.amount > 0);
  const kept = budgets.filter((b) => b.spent <= b.amount).length;
  if (budgets.length > 0 && kept / budgets.length >= 0.6) {
    wins.push({ kind: "budgets-kept", kept, total: budgets.length });
  }

  const saved = input.income - input.expense;
  if (input.income > 0 && saved / input.income >= 0.1) {
    wins.push({
      kind: "saved",
      rate: Math.round((saved / input.income) * 100),
      amount: cents(saved),
    });
  }

  if (overview.shared > 0 && input.transfers.length === 0) wins.push({ kind: "even" });

  const halfway = input.goals
    .filter((g) => g.current < g.target && g.target > 0 && g.current / g.target >= 0.5)
    .sort((a, b) => b.current / b.target - a.current / a.target)[0];
  if (halfway) {
    wins.push({
      kind: "goal-halfway",
      name: halfway.name,
      progress: halfway.current / halfway.target,
    });
  }

  if (wins.length === 0) wins.push({ kind: "showed-up" });
  return wins.slice(0, 3);
}

// ---------- The agenda ----------

export function buildTalk(input: TalkInput) {
  const overview = monthOverview(input);
  return {
    overview,
    contributions: contributions(input),
    goals: talkGoals(input),
    goalCount: input.goals.filter((g) => g.current < g.target).length,
    transfers: input.transfers,
    suggestions: suggestDecisions(input, overview),
    wins: findWins(input, overview),
  };
}

export type MoneyTalk = ReturnType<typeof buildTalk>;
