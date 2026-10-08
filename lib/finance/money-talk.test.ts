import { describe, expect, it } from "vitest";
import {
  buildTalk,
  contributions,
  findWins,
  monthOverview,
  suggestDecisions,
  talkGoals,
  type TalkGoalInput,
  type TalkInput,
} from "./money-talk";

const SPESA = { id: "spesa", name: "Spesa", icon: "shopping-cart", color: "#22c55e" };
const CASA = { id: "casa", name: "Casa", icon: "house", color: "#6366f1" };
const SVAGO = { id: "svago", name: "Svago", icon: "party-popper", color: "#ec4899" };
const VIAGGI = { id: "viaggi", name: "Viaggi", icon: "plane", color: "#0ea5e9" };

const goal = (over: Partial<TalkGoalInput> = {}): TalkGoalInput => ({
  id: "g1",
  name: "Vacanza",
  icon: null,
  color: null,
  target: 4000,
  current: 1000,
  targetDate: "2027-06-30",
  monthly: 334,
  overdue: false,
  reachedLately: false,
  ...over,
});

const base: TalkInput = {
  members: [
    { userId: "anna", name: "Anna", income: 2400 },
    { userId: "luca", name: "Luca", income: 1600 },
  ],
  splitMode: "EQUAL",
  expenses: [
    { userId: "anna", amount: 600, category: CASA },
    { userId: "anna", amount: 300, category: SPESA },
    { userId: "luca", amount: 250, category: SPESA },
    { userId: "luca", amount: 50, category: SVAGO },
  ],
  previous: {
    categories: [
      { ...CASA, amount: 600 },
      { ...SPESA, amount: 500 },
      { ...VIAGGI, amount: 300 },
    ],
  },
  income: 4000,
  expense: 3000,
  budgets: [],
  goals: [],
  transfers: [],
  upcoming: [],
  subscriptions: { count: 0, monthly: 0 },
  tariffs: [],
  lastDecisions: [],
};

describe("the shared month", () => {
  it("adds up the shared expenses, top categories first", () => {
    const o = monthOverview(base);
    expect(o.shared).toBe(1200);
    expect(o.count).toBe(4);
    expect(o.categories.map((c) => [c.name, c.amount])).toEqual([
      ["Casa", 600],
      ["Spesa", 550],
      ["Svago", 50],
    ]);
    expect(o.categories[0].share).toBe(0.5);
  });

  it("compares with the month before and finds what moved the most, even a category gone", () => {
    const o = monthOverview(base);
    expect(o.change).toBeCloseTo(-14.29, 2);
    // Viaggi −300 beats Svago +50 and Spesa +50.
    expect(o.mover).toEqual({ ...VIAGGI, delta: -300 });
  });

  it("ignores small moves and works without a month before", () => {
    const small = monthOverview({
      expenses: [{ userId: "anna", amount: 120, category: SPESA }],
      previous: { categories: [{ ...SPESA, amount: 100 }] },
    });
    expect(small.mover).toBeNull();
    expect(small.change).toBe(20);
    const first = monthOverview({ expenses: base.expenses, previous: null });
    expect(first.change).toBeNull();
    expect(first.mover).toBeNull();
  });
});

describe("who put in what", () => {
  it("compares what each one paid with what the rule asks", () => {
    const c = contributions(base);
    expect(c.mode).toBe("EQUAL");
    expect(c.members.map((m) => [m.name, m.paid, m.paidShare, m.due])).toEqual([
      ["Anna", 900, 0.75, 0.5],
      ["Luca", 300, 0.25, 0.5],
    ]);
  });

  it("follows the income rule, and falls back to halves when an income is missing", () => {
    const byIncome = contributions({ ...base, splitMode: "INCOME" });
    expect(byIncome.members.map((m) => m.due)).toEqual([0.6, 0.4]);
    const missing = contributions({
      ...base,
      splitMode: "INCOME",
      members: [base.members[0], { ...base.members[1], income: null }],
    });
    expect(missing).toMatchObject({ mode: "EQUAL", fallback: true });
  });

  it("keeps apart what was recorded by someone who left", () => {
    const c = contributions({
      ...base,
      expenses: [...base.expenses, { userId: "ex", amount: 80, category: SPESA }],
    });
    expect(c.unattributed).toBe(80);
    expect(c.members[0].paidShare).toBe(0.75);
  });
});

describe("goals", () => {
  it("lists the open goals by date and splits the monthly amount by the rule", () => {
    const goals = talkGoals({
      ...base,
      splitMode: "INCOME",
      goals: [
        goal({ id: "fondo", name: "Fondo emergenza", targetDate: null, monthly: null }),
        goal(),
        goal({ id: "pc", name: "Laptop", current: 1500, target: 1500 }),
      ],
    });
    expect(goals.map((g) => g.name)).toEqual(["Vacanza", "Fondo emergenza"]);
    expect(goals[0].progress).toBe(0.25);
    expect(goals[0].perMember).toEqual([
      { name: "Anna", amount: 201 },
      { name: "Luca", amount: 134 },
    ]);
    expect(goals[1].perMember).toEqual([]);
  });
});

describe("one decision to take", () => {
  const talk = (over: Partial<TalkInput>) => {
    const input = { ...base, ...over };
    return suggestDecisions(input, monthOverview(input));
  };

  it("starts from the budget that went over the most", () => {
    const [first] = talk({
      budgets: [
        { name: "Ristoranti", amount: 180, spent: 260 },
        { name: "Spesa", amount: 450, spent: 470 },
        { name: "Trasporti", amount: 250, spent: 100 },
      ],
    });
    expect(first).toEqual({
      kind: "budget",
      topic: "Budget «Ristoranti»",
      name: "Ristoranti",
      over: 80,
      amount: 180,
    });
  });

  it("keeps at most three, and topics never carry amounts", () => {
    const list = talk({
      budgets: [{ name: "Ristoranti", amount: 180, spent: 260 }],
      goals: [goal()],
      upcoming: [
        { name: "Bollo auto", amount: 180, date: "2026-11-15" },
        { name: "Assicurazione casa", amount: 320, date: "2026-11-20" },
      ],
      transfers: [{ from: "Luca", to: "Anna", amount: 300 }],
      subscriptions: { count: 6, monthly: 74 },
    });
    expect(list.map((s) => s.kind)).toEqual(["budget", "goal-date", "big-expense"]);
    expect(list[1]).toMatchObject({ monthly: 334, until: "2027-06-30" });
    expect(list[2]).toMatchObject({ name: "Assicurazione casa", amount: 320 });
    for (const s of list) expect(s.topic).not.toMatch(/\d/);
  });

  it("asks about a goal whose date has passed before the others", () => {
    const [first] = talk({
      goals: [goal(), goal({ id: "g2", name: "Divano", overdue: true, monthly: 600 })],
    });
    expect(first).toMatchObject({ kind: "goal-overdue", name: "Divano", missing: 3000 });
  });

  it("proposes a common goal when there is none", () => {
    expect(talk({})[0]).toEqual({ kind: "no-goal", topic: "Un obiettivo comune" });
  });

  it("brings up what's owed, the Tariffometro, a category on the rise and subscriptions", () => {
    const list = talk({
      goals: [goal({ targetDate: null, monthly: null })],
      transfers: [{ from: "Luca", to: "Anna", amount: 15 }],
      tariffs: [
        { label: "RC auto · Panda", over: 107.9 },
        { label: "Luce di casa", over: 65.5 },
      ],
      previous: { categories: [{ ...SPESA, amount: 400 }] },
      subscriptions: { count: 5, monthly: 61.9 },
    });
    // 15 € to settle isn't worth a decision; Casa +600 is.
    expect(list.map((s) => s.kind)).toEqual(["tariff", "category-up", "subscriptions"]);
    expect(list[0]).toMatchObject({ topic: "RC auto · Panda", over: 107.9 });
    expect(list[1]).toMatchObject({ name: "Casa", delta: 600 });
  });

  it("always has something to decide", () => {
    expect(talk({ goals: [goal({ targetDate: null, monthly: null })], previous: null })).toEqual([
      { kind: "next-month", topic: "Il mese prossimo" },
    ]);
  });
});

describe("one thing to celebrate", () => {
  const wins = (over: Partial<TalkInput>) => {
    const input = { ...base, ...over };
    return findWins(input, monthOverview(input));
  };

  it("puts a goal reached first, then the decisions kept", () => {
    const list = wins({
      goals: [goal({ name: "Laptop", current: 1500, target: 1500, reachedLately: true })],
      lastDecisions: [{ done: true }, { done: false }],
    });
    expect(list.slice(0, 2)).toEqual([
      { kind: "goal-reached", name: "Laptop" },
      { kind: "decisions-done", done: 1, total: 2 },
    ]);
    expect(list).toHaveLength(3);
  });

  it("doesn't celebrate again a goal reached long ago", () => {
    const list = wins({
      goals: [goal({ current: 1500, target: 1500, reachedLately: false })],
      expense: 3900,
    });
    expect(list.map((w) => w.kind)).toEqual(["spent-less", "even"]);
  });

  it("counts kept budgets and savings", () => {
    const list = wins({
      previous: null,
      budgets: [
        { name: "Spesa", amount: 450, spent: 400 },
        { name: "Ristoranti", amount: 180, spent: 200 },
        { name: "Trasporti", amount: 250, spent: 250 },
      ],
      transfers: [{ from: "Luca", to: "Anna", amount: 300 }],
    });
    expect(list).toEqual([
      { kind: "budgets-kept", kept: 2, total: 3 },
      { kind: "saved", rate: 25, amount: 1000 },
    ]);
  });

  it("finds a goal halfway, and the talk itself when nothing else", () => {
    const quiet = {
      previous: null,
      income: 0,
      transfers: [{ from: "Luca", to: "Anna", amount: 300 }],
    };
    expect(wins({ ...quiet, goals: [goal({ current: 3000 })] })).toEqual([
      { kind: "goal-halfway", name: "Vacanza", progress: 0.75 },
    ]);
    expect(wins(quiet)).toEqual([{ kind: "showed-up" }]);
  });
});

describe("the whole agenda", () => {
  it("puts the five steps together", () => {
    const talk = buildTalk({ ...base, goals: [goal()] });
    expect(talk.overview.shared).toBe(1200);
    expect(talk.contributions.members).toHaveLength(2);
    expect(talk.goals).toHaveLength(1);
    expect(talk.goalCount).toBe(1);
    expect(talk.suggestions.length).toBeGreaterThan(0);
    expect(talk.wins.length).toBeGreaterThan(0);
  });
});
